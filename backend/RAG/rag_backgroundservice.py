import threading
import time
import logging
from enum import Enum
from typing import Optional, Dict
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from backend.RAG.rag_service import rag_system   # your RAG instance
from backend.db.database import SessionLocal       # your DB session factory

logger = logging.getLogger(__name__)


# Status enum — lets the app know exactly what the RAG service is doing


class RAGStatus(str, Enum):
    IDLE        = "idle"          # not started yet
    INDEXING    = "indexing"      # currently indexing
    READY       = "ready"         # indexed and ready to answer queries
    ERROR       = "error"         # indexing failed (app still works)
    RATE_LIMITED = "rate_limited" # Groq rate limited


# ---------------------------------------------------------------------------
# Background RAG Service
# ---------------------------------------------------------------------------

class RAGBackgroundService:
    
    def __init__(
        self,
        reindex_interval_seconds: int = 300,    # re-index every 15 min
        retry_delay_seconds: int = 30,           # wait before retry on error
        max_retries: int = 3,                    # max consecutive failures
    ):
        self.reindex_interval = reindex_interval_seconds
        self.retry_delay = retry_delay_seconds
        self.max_retries = max_retries

        self._status: Dict[str, RAGStatus] = {}   # per-user status
        self._progress: Dict[str, Dict] = {}       # per-user progress info
        self._lock = threading.Lock()

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

        # Track which users need indexing
        self._pending_users: set = set()
        self._pending_lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self):
        """
        Start the background indexing thread.
        Returns immediately — does NOT block.
        """
        if self._thread and self._thread.is_alive():
            logger.info("RAG background service already running.")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._background_loop,
            name="rag-indexer",
            daemon=True        # dies automatically when main process exits
        )
        self._thread.start()
        logger.info("✅ RAG background service started (non-blocking).")

    def stop(self):
        """Signal the background thread to stop gracefully."""
        logger.info("🛑 Stopping RAG background service...")
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("RAG background service stopped.")

    def request_index(self, user_email: str):
        """
        Queue a specific user for (re)indexing.
        Call this after OAuth login or when new emails arrive.
        """
        with self._pending_lock:
            self._pending_users.add(user_email)
        logger.info(f"📥 Queued RAG index for {user_email}")

    def get_status(self, user_email: str) -> Dict:
        """
        Get current indexing status for a user.
        Safe to call from any request handler.
        """
        with self._lock:
            status = self._status.get(user_email, RAGStatus.IDLE)
            progress = self._progress.get(user_email, {})

        rag_stats = {}
        try:
            rag_stats = rag_system.get_stats(user_email)
        except Exception:
            pass

        return {
            "status": status,
            "is_ready": status == RAGStatus.READY,
            "is_indexing": status == RAGStatus.INDEXING,
            **progress,
            **rag_stats,
        }

    def is_ready(self, user_email: str) -> bool:
        with self._lock:
            return self._status.get(user_email) == RAGStatus.READY

    # ------------------------------------------------------------------
    # Background loop
    # ------------------------------------------------------------------

    def _background_loop(self):
        """
        Main loop:
          1. Index any pending users immediately.
          2. Sleep for reindex_interval, then re-index all known users.
          3. Repeat until stop() is called.
        """
        logger.info("🔄 RAG background loop running...")

        # Brief startup delay so the app fully initialises its DB pool first
        time.sleep(3)

        while not self._stop_event.is_set():
            # --- Process any users queued via request_index() ---
            with self._pending_lock:
                pending = list(self._pending_users)
                self._pending_users.clear()

            for user_email in pending:
                if self._stop_event.is_set():
                    break
                self._index_user_with_retry(user_email)

            # --- Periodic re-index of all known users ---
            known_users = []
            with self._lock:
                known_users = list(self._status.keys())

            for user_email in known_users:
                if self._stop_event.is_set():
                    break
                # Only re-index users that are already READY (not mid-index or errored)
                with self._lock:
                    current = self._status.get(user_email)
                if current == RAGStatus.READY:
                    self._index_user_with_retry(user_email)

            # --- Sleep until next cycle (or until stop() is called) ---
            self._stop_event.wait(timeout=self.reindex_interval)

        logger.info("RAG background loop exited.")

    def _index_user_with_retry(self, user_email: str):
        """Index a single user with retry logic."""
        for attempt in range(1, self.max_retries + 1):
            if self._stop_event.is_set():
                return

            try:
                self._set_status(user_email, RAGStatus.INDEXING, {
                    "attempt": attempt,
                    "started_at": time.time(),
                })

                db: Session = SessionLocal()
                try:
                    result = rag_system.index_user_emails(db, user_email)
                finally:
                    db.close()

                self._set_status(user_email, RAGStatus.READY, {
                    "last_indexed_at": time.time(),
                    "emails_indexed": result.get("email_count", 0),
                    "new_emails": result.get("new_emails", 0),
                    "index_time_seconds": result.get("time_seconds", 0),
                    "message": result.get("message", ""),
                })
                logger.info(f"✅ RAG index done for {user_email}: {result.get('message')}")
                return   # success — exit retry loop

            except Exception as e:
                logger.error(f"❌ RAG index attempt {attempt}/{self.max_retries} "
                             f"failed for {user_email}: {e}")

                if attempt < self.max_retries:
                    backoff = self.retry_delay * attempt   # 30s, 60s, 90s...
                    logger.info(f"⏳ Retrying in {backoff}s...")
                    self._stop_event.wait(timeout=backoff)
                else:
                    self._set_status(user_email, RAGStatus.ERROR, {
                        "error": str(e),
                        "failed_at": time.time(),
                    })
                    logger.error(f"💥 RAG indexing permanently failed for {user_email}. "
                                 f"App still works — RAG just unavailable.")

    def _set_status(self, user_email: str, status: RAGStatus, extra: Dict = None):
        with self._lock:
            self._status[user_email] = status
            self._progress[user_email] = extra or {}


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------
rag_service = RAGBackgroundService(
    reindex_interval_seconds=300,   # re-index every 15 minutes
    retry_delay_seconds=30,
    max_retries=3,
)


# ---------------------------------------------------------------------------
# FastAPI integration helpers
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app):
    rag_service.start()
    yield
    rag_service.stop()
