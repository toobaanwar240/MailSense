"""
RAG Router - Endpoints for RAG-based email search
✅ FIXED VERSION
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import traceback

from backend.db.database import get_db
from backend.db.models import User, Email

# ✅ FIXED: Import from correct path (lowercase 'rag', not 'RAG')
try:
    from backend.RAG.rag_service import rag_system
    print("✅ RAG system imported successfully")
except ImportError as e:
    print(f"❌ Failed to import rag_system: {e}")
    print("   Make sure backend/rag/rag_system.py exists")
    raise

# ✅ FIXED: Create helper to get email string from User object
try:
    from backend.router.dependencies import get_current_user as get_user_object
    
    def get_current_user_email(user: User = Depends(get_user_object)) -> str:
        """Convert User object to email string for RAG system."""
        if hasattr(user, 'email'):
            return user.email
        elif hasattr(user, 'email_address'):
            return user.email_address
        else:
            raise HTTPException(status_code=500, detail="User has no email field")
    
    print("✅ Using JWT authentication")
    
except ImportError:
    print("⚠️ JWT auth not found, using fallback")
    
    def get_current_user_email(db: Session = Depends(get_db)) -> str:
        """Fallback: Get first user's email."""
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
    current_user_email: str = Depends(get_current_user_email),  # ✅ FIXED: Now gets email string
    db: Session = Depends(get_db)
):
    """
    Index all emails for RAG search.
    This endpoint processes all user emails and creates vector embeddings.
    """
    print(f"\n📊 /rag/index called for user: {current_user_email}")
    
    try:
        # ✅ FIXED: Pass email string (not User object)
        result = rag_system.index_user_emails(db, current_user_email)
        print(f"✅ Indexing complete: {result.get('message', 'Done')}")
        return result
    except ValueError as e:
        print(f"❌ ValueError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ ERROR in /rag/index: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")


@router.post("/ask")
def rag_ask(
    request: RAGQuestionRequest,
    current_user_email: str = Depends(get_current_user_email),  # ✅ FIXED: Now gets email string
    db: Session = Depends(get_db)
):
    """
    Ask questions about emails using RAG.
    Returns AI-generated answers based on email content.
    """
    print(f"\n❓ /rag/ask called: '{request.question}' for user: {current_user_email}")
    
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    try:
        # ✅ FIXED: Pass email string (not User object)
        result = rag_system.answer_question(current_user_email, request.question, db=db)
        print(f"✅ Answer generated")
        return result
    except Exception as e:
        print(f"❌ ERROR in /rag/ask: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Question processing failed: {str(e)}")


@router.get("/stats")
def rag_stats(current_user_email: str = Depends(get_current_user_email)):  # ✅ FIXED: Now gets email string
    """
    Get RAG statistics for the current user.
    Returns info about indexed emails and system status.
    """
    print(f"\n📈 /rag/stats called for user: {current_user_email}")
    
    try:
        # ✅ FIXED: Pass email string (not User object)
        stats = rag_system.get_stats(current_user_email)
        print(f"✅ Stats retrieved: {stats}")
        return stats
    except Exception as e:
        print(f"❌ ERROR in /rag/stats: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stats retrieval failed: {str(e)}")


# ================= Admin Endpoints =================

@router.get("/admin/status")
def admin_status(
    current_user_email: str = Depends(get_current_user_email),  # ✅ FIXED: Now gets email string
    db: Session = Depends(get_db)
):
    """
    Get comprehensive system status.
    Includes user info, database stats, and RAG stats.
    """
    print(f"\n🔍 /rag/admin/status called for user: {current_user_email}")
    
    try:
        # Step 1: Get user
        print(f"1️⃣ Looking up user...")
        user = db.query(User).filter(User.email == current_user_email).first()
        if not user:
            print(f"❌ User not found: {current_user_email}")
            raise HTTPException(status_code=404, detail="User not found")
        print(f"✅ User found: ID={user.id}")

        # Step 2: Get all emails for this user
        print(f"2️⃣ Getting emails...")
        all_emails = db.query(Email).filter(Email.user_id == user.id).all()
        print(f"✅ Found {len(all_emails)} emails")
        
        # Step 3: Try to get read/unread counts (handle missing is_read field)
        print(f"3️⃣ Counting read/unread...")
        try:
            unread = [e for e in all_emails if hasattr(e, 'is_read') and not e.is_read]
            read = [e for e in all_emails if hasattr(e, 'is_read') and e.is_read]
        except Exception as e:
            print(f"⚠️ is_read field issue: {e}")
            # If is_read doesn't exist, just show total
            unread = []
            read = all_emails
        print(f"✅ Unread: {len(unread)}, Read: {len(read)}")

        # Step 4: Get RAG stats
        print(f"4️⃣ Getting RAG stats...")
        try:
            # ✅ FIXED: Pass email string (not User object)
            rag_stats = rag_system.get_stats(current_user_email)
            print(f"✅ RAG stats: {rag_stats}")
        except Exception as e:
            print(f"❌ RAG stats error: {e}")
            traceback.print_exc()
            # Return partial data if RAG fails
            rag_stats = {
                "indexed_emails": 0,
                "is_ready": False,
                "error": str(e)
            }

        # Step 5: Build response
        print(f"5️⃣ Building response...")
        response = {
            "user": {
                "email": current_user_email,
                "name": getattr(user, 'name', current_user_email.split('@')[0])  # Fallback if name doesn't exist
            },
            "database": {
                "total_emails": len(all_emails),
                "unread_emails": len(unread),
                "read_emails": len(read)
            },
            "rag": rag_stats
        }
        
        print(f"✅ Response ready")
        return response
        
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
    Verifies that the RAG system is initialized and ready.
    """
    print(f"\n❤️ /rag/health called")
    
    try:
        # Check if RAG system is initialized
        is_initialized = hasattr(rag_system, 'chroma_client') and \
                        hasattr(rag_system, 'embedding_model') and \
                        hasattr(rag_system, 'groq_client')
        
        cache_size = len(rag_system.query_cache) if hasattr(rag_system, 'query_cache') else 0
        
        result = {
            "status": "healthy" if is_initialized else "unhealthy",
            "initialized": is_initialized,
            "cache_size": cache_size
        }
        
        print(f"✅ Health check: {result}")
        return result
        
    except Exception as e:
        print(f"❌ Health check error: {e}")
        traceback.print_exc()
        return {
            "status": "unhealthy",
            "error": str(e)
        }