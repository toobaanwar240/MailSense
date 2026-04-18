import threading
import time
from datetime import datetime
from backend.db.database import SessionLocal
from backend.db.gmail_service import fetch_user_emails
from backend.RAG.rag_backgroundservice import rag_service

polling_threads: dict = {}

def _auto_index_after_fetch(user_email: str):
    rag_service.request_index(user_email)
    print(f"  📊 Re-index queued for {user_email}")

def _poll_emails_continuously(user_id: int, user_email: str, interval: int = 60):
    print(f"🔄 Polling thread started for user {user_id} ({user_email})")
    while True:
        db = SessionLocal()
        try:
            ts = datetime.now().strftime('%H:%M:%S')
            print(f"⏰ [{ts}] Fetching emails for user {user_id}...")
            new_count = fetch_user_emails(db, user_id)
            if new_count > 0:
                print(f"✅ [{ts}] Fetched {new_count} new emails")
                _auto_index_after_fetch(user_email)
            else:
                print(f"ℹ️  [{ts}] No new emails")
        except Exception as e:
            print(f"❌ Polling error for user {user_id}: {e}")
        finally:
            db.close()
        time.sleep(interval)

def on_new_user_login(user_id: int, user_email: str):
    rag_service.request_index(user_email)
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

def start_polling_threads():
    from backend.db import models
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
    except Exception as e:
        print(f"❌ Failed to start polling threads: {e}")
    finally:
        db.close()