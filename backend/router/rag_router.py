"""
RAG Router - Endpoints for RAG-based email search
✅ Updated to use RAGBackgroundService (non-blocking indexing)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import traceback

from backend.db.database import get_db
from backend.db.models import User, Email

# ✅ Import BOTH the background service AND rag_system (for direct queries)
try:
    from backend.RAG.rag_service import rag_system
    from backend.RAG.rag_backgroundservice import rag_service   # ← NEW
    print("✅ RAG system + background service imported successfully")
except ImportError as e:
    print(f"❌ Failed to import RAG modules: {e}")
    raise

try:
    from backend.router.dependencies import get_current_user as get_user_object

    def get_current_user_email(user: User = Depends(get_user_object)) -> str:
        if hasattr(user, 'email'):
            return user.email
        elif hasattr(user, 'email_address'):
            return user.email_address
        raise HTTPException(status_code=500, detail="User has no email field")

    print("✅ Using JWT authentication")

except ImportError:
    print("⚠️  JWT auth not found, using fallback")

    def get_current_user_email(db: Session = Depends(get_db)) -> str:
        user = db.query(User).first()
        if not user:
            raise HTTPException(status_code=404, detail="No users in database")
        return user.email if hasattr(user, 'email') else user.email_address


router = APIRouter()


# ================= Request Models =================

class RAGQuestionRequest(BaseModel):
    question: str


# ================= RAG Endpoints =================

@router.post("/index")
def rag_index(
    current_user_email: str = Depends(get_current_user_email),
):
    """
    ✅ CHANGED: No longer blocks the request doing indexing inline.
    Queues the user for background indexing and returns immediately.
    The frontend should poll /rag/status to know when it's ready.
    """
    print(f"\n📊 /rag/index called for user: {current_user_email}")

    try:
        # ✅ CHANGED: queue instead of blocking index
        rag_service.request_index(current_user_email)
        return {
            "status": "queued",
            "message": "Indexing queued in background. Poll /rag/status for progress."
        }
    except Exception as e:
        print(f"❌ ERROR in /rag/index: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to queue indexing: {str(e)}")


@router.get("/status")
def rag_status(
    current_user_email: str = Depends(get_current_user_email),
):
    """
    ✅ NEW: Poll this to check if indexing is complete.
    
    Possible status values:
      - "idle"       → not started yet (call /rag/index first)
      - "indexing"   → currently running in background
      - "ready"      → done, queries will work
      - "error"      → indexing failed (app still works, RAG unavailable)
    
    Frontend usage:
        setInterval(() => {
            fetch('/rag/status').then(r => r.json()).then(s => {
                if (s.is_ready) clearInterval(...)
            })
        }, 3000)
    """
    print(f"\n📡 /rag/status called for user: {current_user_email}")
    try:
        return rag_service.get_status(current_user_email)
    except Exception as e:
        print(f"❌ ERROR in /rag/status: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Store history per user 
conversation_histories = {}

@router.post("/ask")
def rag_ask(
    request: RAGQuestionRequest,
    current_user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    print(f"\n❓ /rag/ask called: '{request.question}' for user: {current_user_email}")

    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    status = rag_service.get_status(current_user_email)

    if status["status"] == "idle":
        rag_service.request_index(current_user_email)
        return {
            "answer": "Your emails are being indexed for the first time. Please try again in a moment.",
            "status": "indexing",
            "is_ready": False,
            "sources": [],
        }

    if status["status"] == "indexing":
        return {
            "answer": "Still indexing your emails, please try again in a few seconds.",
            "status": "indexing",
            "is_ready": False,
            "sources": [],
        }

    if status["status"] == "error":
        return {
            "answer": "Email indexing encountered an error. RAG search may be incomplete.",
            "status": "error",
            "is_ready": False,
            "sources": [],
        }

    try:
        # ✅ Get or create history for this user
        if current_user_email not in conversation_histories:
            conversation_histories[current_user_email] = []

        history = conversation_histories[current_user_email]

        # ✅ Pass history to answer_question
        result = rag_system.answer_question(
            current_user_email,
            request.question,
            db=db,
            conversation_history=history
        )

        # ✅ Update history after getting answer
        if result.get("status") == "success":
            history.append({"role": "user", "content": request.question})
            history.append({"role": "assistant", "content": result["answer"]})
            
            # Keep only last 20 messages
            conversation_histories[current_user_email] = history[-20:]

        print("✅ Answer generated")
        return result

    except Exception as e:
        print(f"❌ ERROR in /rag/ask: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Question processing failed: {str(e)}")

@router.get("/stats")
def rag_stats(
    current_user_email: str = Depends(get_current_user_email),
):
    """
    Get RAG statistics for the current user.
    ✅ CHANGED: Now merges background service status with rag_system stats.
    """
    print(f"\n📈 /rag/stats called for user: {current_user_email}")
    try:
        # ✅ CHANGED: get_status already merges rag_system.get_stats() internally
        return rag_service.get_status(current_user_email)
    except Exception as e:
        print(f"❌ ERROR in /rag/stats: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stats retrieval failed: {str(e)}")


# ================= Admin Endpoints =================

@router.get("/admin/status")
def admin_status(
    current_user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive system status.
    ✅ CHANGED: Background service status included in response.
    """
    print(f"\n🔍 /rag/admin/status called for user: {current_user_email}")

    try:
        user = db.query(User).filter(User.email == current_user_email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        all_emails = db.query(Email).filter(Email.user_id == user.id).all()

        try:
            unread = [e for e in all_emails if hasattr(e, 'is_read') and not e.is_read]
            read   = [e for e in all_emails if hasattr(e, 'is_read') and e.is_read]
        except Exception:
            unread, read = [], all_emails

        # ✅ CHANGED: use background service status (includes rag_system stats)
        service_status = rag_service.get_status(current_user_email)

        return {
            "user": {
                "email": current_user_email,
                "name": getattr(user, 'name', current_user_email.split('@')[0])
            },
            "database": {
                "total_emails": len(all_emails),
                "unread_emails": len(unread),
                "read_emails": len(read),
            },
            "rag": service_status,   # ✅ richer than before — includes indexing progress
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ FATAL ERROR in /rag/admin/status: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Status retrieval failed: {str(e)}")


# ================= Health Check =================

@router.get("/health")
def rag_health():
    """
    RAG system health check.
    ✅ CHANGED: Also reports background service thread health.
    """
    print("\n❤️ /rag/health called")

    try:
        is_initialized = (
            hasattr(rag_system, 'chroma_client') and
            hasattr(rag_system, 'embedding_model') and
            hasattr(rag_system, 'groq_client')
        )

        # ✅ NEW: check background thread is alive
        thread_alive = (
            rag_service._thread is not None and
            rag_service._thread.is_alive()
        )

        cache_size = len(rag_service.query_cache) if hasattr(rag_service, 'query_cache') else 0

        result = {
            "status": "healthy" if (is_initialized and thread_alive) else "degraded",
            "rag_initialized": is_initialized,
            "background_thread_alive": thread_alive,
            "cache_size": cache_size,
        }
        print(f"✅ Health check: {result}")
        return result

    except Exception as e:
        print(f"❌ Health check error: {e}")
        traceback.print_exc()
        return {"status": "unhealthy", "error": str(e)}