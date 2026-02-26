from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import threading
import time

from backend.router import email, ai, auth, rag_router
from backend.db import models
from backend.db.database import engine, SessionLocal
from backend.db.gmail_service import fetch_user_emails
from backend.RAG.rag_backgroundservice import rag_service
from fastapi.security import HTTPBearer
from fastapi import Security

bearer_scheme = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):

    # ── 1. Initialize database (create tables if they don't exist) ─────────
    models.Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready")

    # ── 2. Start RAG background indexing thread (non-blocking) ──────────
    rag_service.start()
    print("✅ RAG background service started")

    # ── 3. Queue existing authenticated users for RAG indexing ──────────
    db = SessionLocal()
    try:
        users = db.query(models.User).filter(
            models.User.access_token.isnot(None)
        ).all()
        print(f"👥 Found {len(users)} authenticated user(s) — queuing RAG index...")
        for user in users:
            rag_service.request_index(user.email)   # non-blocking queue
            print(f"  📥 Queued: {user.email}")
    except Exception as e:
        print(f"⚠️  Could not queue users for RAG indexing: {e}")
    finally:
        db.close()

    # ── 4. Start email polling threads ───────────────────────────────────
    _start_polling_threads()

    # ── App is now fully running ─────────────────────────────────────────
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────
    print("\n🛑 Shutting down...")
    rag_service.stop()
    print("✅ RAG background service stopped")
    print("✅ Shutdown complete")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Gmail AI Assistant API",
    version="1.0.0",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
    openapi_extra={
        "components": {
            "securitySchemes": {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT"
                }
            }
        },
        "security": [{"BearerAuth": []}]
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8501", "http://127.0.0.1:8501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/auth",  tags=["Authentication"])
app.include_router(email.router,      prefix="/email", tags=["Email"])
app.include_router(ai.router,         prefix="/ai",    tags=["AI"])
app.include_router(rag_router.router, prefix="/rag",   tags=["RAG"])


# ---------------------------------------------------------------------------
# Email polling (unchanged logic, just moved to a plain function)
# ---------------------------------------------------------------------------

polling_threads: dict = {}


def _auto_index_after_fetch(user_email: str):
    """
    After new emails are fetched, tell the background service to re-index.
    Non-blocking — just queues it.
    """
    rag_service.request_index(user_email)
    print(f"  📊 Re-index queued for {user_email}")


def _poll_emails_continuously(user_id: int, user_email: str, interval: int = 60):
    """Poll Gmail and trigger RAG re-index whenever new emails arrive."""
    print(f"🔄 Polling thread started for user {user_id} ({user_email})")

    while True:
        db = SessionLocal()
        try:
            ts = datetime.now().strftime('%H:%M:%S')
            print(f"⏰ [{ts}] Fetching emails for user {user_id}...")

            new_count = fetch_user_emails(db, user_id)

            if new_count > 0:
                print(f"✅ [{ts}] Fetched {new_count} new emails")
                _auto_index_after_fetch(user_email)   # ✅ queue, not block
            else:
                print(f"ℹ️  [{ts}] No new emails")

        except Exception as e:
            print(f"❌ [{datetime.now().strftime('%H:%M:%S')}] Polling error for user {user_id}: {e}")
        finally:
            db.close()

        time.sleep(interval)


def _start_polling_threads():
    """Start one polling thread per authenticated user."""
    db = SessionLocal()
    try:
        users = db.query(models.User).filter(
            models.User.access_token.isnot(None)
        ).all()
        print(f"\n🚀 Starting email polling for {len(users)} user(s)...\n")

        for user in users:
            thread = threading.Thread(
                target=_poll_emails_continuously,
                args=(user.id, user.email, 60),
                daemon=True,
                name=f"EmailPoller-User{user.id}",
            )
            thread.start()
            polling_threads[user.id] = thread
            print(f"✅ Polling thread started for user {user.id} ({user.email})")

        print()
    except Exception as e:
        print(f"❌ Failed to start polling threads: {e}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Call this from your auth router after a NEW user logs in via OAuth
# ---------------------------------------------------------------------------

def on_new_user_login(user_id: int, user_email: str):
    """
    Call this right after OAuth completes for a brand-new user so their
    emails get fetched and indexed immediately without waiting for the
    next polling cycle.

    Example in your auth router:
        from backend.main import on_new_user_login
        on_new_user_login(user.id, user.email)
    """
    # Queue RAG index for this user
    rag_service.request_index(user_email)

    # Start a polling thread if one isn't already running
    if user_id not in polling_threads or not polling_threads[user_id].is_alive():
        thread = threading.Thread(
            target=_poll_emails_continuously,
            args=(user_id, user_email, 60),
            daemon=True,
            name=f"EmailPoller-User{user_id}",
        )
        thread.start()
        polling_threads[user_id] = thread
        print(f"✅ Polling thread started for new user {user_id} ({user_email})")


# ---------------------------------------------------------------------------
# Health / Debug endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
def read_root():
    return {
        "status": "running",
        "service": "Gmail AI Assistant API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/debug/polling-status", tags=["Debug"])
def debug_polling_status():
    status = {
        uid: {
            "thread_name": t.name,
            "is_alive": t.is_alive(),
            "daemon": t.daemon,
        }
        for uid, t in polling_threads.items()
    }
    alive = sum(1 for t in polling_threads.values() if t.is_alive())
    return {
        "status": "healthy" if alive == len(polling_threads) else "degraded",
        "active_threads": alive,
        "total_threads": len(polling_threads),
        "threads": status,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/debug/rag-stats", tags=["Debug"])
def debug_rag_stats():
    db = SessionLocal()
    try:
        users = db.query(models.User).filter(
            models.User.access_token.isnot(None)
        ).all()
        return {
            "total_users": len(users),
            "user_stats": {
                user.email: rag_service.get_status(user.email)   # ✅ richer than before
                for user in users
            },
            "timestamp": datetime.now().isoformat(),
        }
    finally:
        db.close()


@app.get("/debug/db-stats", tags=["Debug"])
def debug_db_stats():
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        return {
            "total_users": db.query(models.User).count(),
            "total_emails": db.query(models.Email).count(),
            "user_stats": [
                {
                    "user_id": u.id,
                    "email": u.email,
                    "email_count": db.query(models.Email)
                        .filter(models.Email.user_id == u.id).count(),
                }
                for u in users
            ],
            "timestamp": datetime.now().isoformat(),
        }
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)