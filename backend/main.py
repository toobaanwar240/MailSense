from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.router import email, ai, auth, rag_router
from backend.db import models
from backend.db.database import engine, SessionLocal
from backend.db.gmail_service import fetch_user_emails
from backend.RAG.rag_service import rag_system  # Import RAG system
import threading
import time
from datetime import datetime

app = FastAPI(title="Gmail AI Assistant API", version="1.0.0")

# CORS middleware for Streamlit frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8501", "http://127.0.0.1:8501"],  # Streamlit default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(email.router, prefix="/email", tags=["Email"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])
app.include_router(rag_router.router, prefix="/rag", tags=["RAG"])  # ✅ ADDED RAG Router

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Track polling threads
polling_threads = {}

def auto_index_emails(user_id: int, user_email: str):
    """Automatically index new emails for RAG after fetching"""
    db = SessionLocal()
    try:
        print(f"  📊 Auto-indexing emails for {user_email}...")
        result = rag_system.index_user_emails(db, user_email)
        if result.get("status") == "success":
            print(f"  ✅ Indexed {result.get('new_emails', 0)} new emails")
        else:
            print(f"  ⚠️ Indexing result: {result.get('message', 'Unknown')}")
    except Exception as e:
        print(f"  ❌ Auto-indexing failed: {e}")
    finally:
        db.close()

def poll_emails_continuously(user_id: int, user_email: str, interval: int = 60):
    """Poll emails continuously and auto-index for RAG"""
    thread_id = threading.current_thread().ident
    print(f"🔄 Polling thread {thread_id} started for user {user_id} ({user_email})")
    
    while True:
        db = SessionLocal()
        try:
            timestamp = datetime.now().strftime('%H:%M:%S')
            print(f"⏰ [{timestamp}] Fetching emails for user {user_id}...")
            
            # Fetch new emails from Gmail
            new_count = fetch_user_emails(db, user_id)
            
            if new_count > 0:
                print(f"✅ [{timestamp}] Fetched {new_count} new emails")
                
                # Auto-index new emails for RAG
                auto_index_emails(user_id, user_email)
                
            else:
                print(f"ℹ️ [{timestamp}] No new emails")
            
        except Exception as e:
            print(f"❌ [{datetime.now().strftime('%H:%M:%S')}] Error for user {user_id}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            db.close()
        
        print(f"💤 [{datetime.now().strftime('%H:%M:%S')}] Sleeping for {interval} seconds...")
        time.sleep(interval)

@app.on_event("startup")
async def start_email_polling():
    """Start email polling for all authenticated users"""
    db = SessionLocal()
    try:
        # Get all users with valid tokens
        users = db.query(models.User).filter(
            models.User.access_token.isnot(None)
        ).all()
        
        print(f"\n🚀 Starting email polling for {len(users)} users\n")
        
        for user in users:
            user_email = user.email  # Use the correct field from your DB
            
            # Initial fetch and index
            print(f"📥 Initial fetch for user {user.id} ({user_email})...")
            try:
                # Fetch initial emails
                initial_count = fetch_user_emails(db, user.id, max_results=100)
                print(f"  ✅ Fetched {initial_count} initial emails")
                
                # Initial RAG indexing
                print(f"  📊 Initial RAG indexing...")
                result = rag_system.index_user_emails(db, user_email)
                print(f"  ✅ {result.get('message', 'Indexing complete')}")
                
            except Exception as e:
                print(f"  ❌ Initial setup failed for user {user.id}: {e}")
                import traceback
                traceback.print_exc()
            
            # Start polling thread (60 second interval - adjust as needed)
            thread = threading.Thread(
                target=poll_emails_continuously,
                args=(user.id, user_email, 60),  # Poll every 60 seconds
                daemon=True,
                name=f"EmailPoller-User{user.id}"
            )
            thread.start()
            polling_threads[user.id] = thread
            print(f"✅ Started polling thread for user {user.id}\n")
            
        print(f"🎉 All polling threads started successfully!\n")
        
    except Exception as e:
        print(f"❌ Startup error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("\n🛑 Shutting down email polling...")
    for user_id, thread in polling_threads.items():
        print(f"  Stopping thread for user {user_id}")
    print("✅ Shutdown complete\n")

# ================= DEBUG ENDPOINTS =================

@app.get("/", tags=["Health"])
def read_root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "Gmail AI Assistant API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/debug/polling-status", tags=["Debug"])
def debug_polling_status():
    """Check if polling threads are still alive"""
    status = {}
    for user_id, thread in polling_threads.items():
        status[user_id] = {
            "thread_id": thread.ident,
            "thread_name": thread.name,
            "is_alive": thread.is_alive(),
            "daemon": thread.daemon
        }
    
    alive_count = len([t for t in polling_threads.values() if t.is_alive()])
    
    return {
        "status": "healthy" if alive_count == len(polling_threads) else "degraded",
        "active_threads": alive_count,
        "total_threads": len(polling_threads),
        "threads": status,
        "current_time": datetime.now().isoformat()
    }

@app.get("/debug/rag-stats", tags=["Debug"])
def debug_rag_stats():
    """Get RAG statistics for all users"""
    db = SessionLocal()
    try:
        users = db.query(models.User).filter(
            models.User.access_token.isnot(None)
        ).all()
        
        stats = {}
        for user in users:
            user_email = user.email
            stats[user_email] = rag_system.get_stats(user_email)
        
        return {
            "total_users": len(users),
            "user_stats": stats,
            "timestamp": datetime.now().isoformat()
        }
    finally:
        db.close()

@app.get("/debug/db-stats", tags=["Debug"])
def debug_db_stats():
    """Get database statistics"""
    db = SessionLocal()
    try:
        total_users = db.query(models.User).count()
        total_emails = db.query(models.Email).count()
        
        user_stats = []
        users = db.query(models.User).all()
        for user in users:
            email_count = db.query(models.Email).filter(
                models.Email.user_id == user.id
            ).count()
            user_stats.append({
                "user_id": user.id,
                "email": user.email,
                "email_count": email_count
            })
        
        return {
            "total_users": total_users,
            "total_emails": total_emails,
            "user_stats": user_stats,
            "timestamp": datetime.now().isoformat()
        }
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)