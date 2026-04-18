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
from backend.services.polling import (
    polling_threads,
    on_new_user_login,
    start_polling_threads,
)

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
    start_polling_threads()

    # ── App is now fully running ─────────────────────────────────────────
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────
    print("\nShutting down...")
    rag_service.stop()
    print(" RAG background service stopped")
    print("Shutdown complete")


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