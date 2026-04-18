from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from backend.db.models import User, Email
from email.utils import parsedate_to_datetime
import os
import base64
from datetime import datetime

load_dotenv()

TOKEN_URL = "https://oauth2.googleapis.com/token"
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")


def get_gmail_service(db, user_id: int):
    """Get authenticated Gmail service for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    if not user.access_token:
        raise ValueError("User not authenticated with Google")

    creds = Credentials(
        token=user.access_token,
        refresh_token=user.refresh_token,
        token_uri=TOKEN_URL,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
    )

    # Refresh token if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        
        # Save new token to database
        user.access_token = creds.token
        db.commit()

    return build("gmail", "v1", credentials=creds)


def extract_body(payload):
    """Extract email body from Gmail payload."""
    import html2text
    
    def decode_data(data):
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    
    def extract_from_parts(parts):
        plain = None
        html = None
        for part in parts:
            mime = part.get("mimeType", "")
            data = part.get("body", {}).get("data")
            
            # Recurse into nested multipart
            if mime.startswith("multipart/") and part.get("parts"):
                result = extract_from_parts(part["parts"])
                if result:
                    return result
            
            if mime == "text/plain" and data:
                plain = decode_data(data)
            elif mime == "text/html" and data:
                html = decode_data(data)
        
        if plain:
            return plain
        if html:
            # Convert HTML to plain text
            h = html2text.HTML2Text()
            h.ignore_links = True
            h.ignore_images = True
            return h.handle(html)
        return ""

    # Try direct body first
    if payload.get("body", {}).get("data"):
        return decode_data(payload["body"]["data"])

    # Try parts
    if payload.get("parts"):
        return extract_from_parts(payload["parts"])

    return ""

def fetch_user_emails(db, user_id: int, max_results: int = 100) -> int:
    try:
        service = get_gmail_service(db, user_id)

        last_email = (
            db.query(Email)
            .filter(Email.user_id == user_id)
            .order_by(Email.date.desc())
            .first()
        )

        # Build query
        query_parts = []

        if last_email and last_email.date:
            after_date = last_email.date.strftime("%Y/%m/%d")
            query_parts.append(f"after:{after_date}")
            print(f"🔍 Fetching emails after {after_date}")
        else:
            print("⚠️ No valid date found - fetching latest emails")

        # Always combine with inbox filter
        query_parts.append("in:inbox")
        final_query = " ".join(query_parts)

        list_params = {
            "userId": "me",
            "maxResults": max_results,
            "q": final_query,  # single clean query, never overwritten
        }

        print(f"📨 Gmail query: {final_query}")

        results = service.users().messages().list(**list_params).execute()
        messages = results.get("messages", [])
        print(f"📬 Gmail returned {len(messages)} messages")

        if not messages:
            return 0

        saved_count = 0
        skipped_count = 0

        for msg in messages:
            exists = (
                db.query(Email)
                .filter(Email.message_id == msg["id"], Email.user_id == user_id)
                .first()
            )
            if exists:
                skipped_count += 1
                continue

            msg_data = service.users().messages().get(
                userId="me", id=msg["id"], format="full"
            ).execute()

            headers = msg_data.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "")
            date_str = next((h["value"] for h in headers if h["name"] == "Date"), None)

            try:
                email_date = parsedate_to_datetime(date_str) if date_str else datetime.utcnow()
            except Exception:
                email_date = datetime.utcnow()

            labels = msg_data.get("labelIds", [])

            # Fix: only check INBOX, drop CATEGORY_PERSONAL requirement
            if "INBOX" not in labels:
                print(f"⏭️ Skipping non-INBOX: {subject[:50]}")
                continue

            body = extract_body(msg_data["payload"])
            snippet = msg_data.get("snippet", "")
            labels_str = ",".join(labels)

            email = Email(
                user_id=user_id,
                message_id=msg["id"],
                sender=sender,
                subject=subject,
                snippet=snippet,
                body=body,
                date=email_date,  # always saved now, never NULL
                labels=labels_str,
            )

            if hasattr(Email, "is_read"):
                email.is_read = "UNREAD" not in labels

            db.add(email)
            db.commit()
            db.refresh(email)
            saved_count += 1

        print(f"✅ Saved {saved_count}, skipped {skipped_count} for user {user_id}")
        return saved_count

    except Exception as e:
        print(f"❌ Error fetching emails: {e}")
        import traceback
        traceback.print_exc()
        return 0

def fetch_all_user_emails(db, user_id: int, max_results: int = 500) -> int:
    """
    Fetch ALL INBOX emails for a user (not just new ones).
    Useful for initial setup or re-sync.
    """
    try:
        service = get_gmail_service(db, user_id)
        
        print(f" Fetching ALL INBOX emails for user {user_id} (max: {max_results})")
        
        # Fetch INBOX only
        list_params = {
            "userId": "me",
            "maxResults": max_results,
            "labelIds": ["INBOX"],  #  Only INBOX
        }
        
        results = service.users().messages().list(**list_params).execute()
        messages = results.get("messages", [])
        print(f" Gmail returned {len(messages)} INBOX messages")
        
        if not messages:
            print("ℹ No messages found")
            return 0
        
        saved_count = 0
        skipped_count = 0

        for msg in messages:
            # Check if already exists
            exists = (
                db.query(Email)
                .filter(Email.message_id == msg["id"], Email.user_id == user_id)
                .first()
            )
            if exists:
                skipped_count += 1
                continue

            # Fetch full message
            msg_data = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="full",
            ).execute()

            headers = msg_data.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "")
            date_str = next((h["value"] for h in headers if h["name"] == "Date"), None)
            
            try:
                email_date = parsedate_to_datetime(date_str) if date_str else datetime.utcnow()
            except Exception as e:
                print(f" Failed to parse date '{date_str}': {e}")
                email_date = datetime.utcnow()
            
            body = extract_body(msg_data["payload"])
            snippet = msg_data.get("snippet", "")
            
            #  NEW: Extract and save labels
            labels = msg_data.get("labelIds", [])
            labels_str = ','.join(labels)
            
            # Verify INBOX
            if 'INBOX' not in labels:
                print(f" Skipping non-INBOX email: {subject[:50]}")
                continue
            
            email = Email(
                user_id=user_id,
                message_id=msg["id"],
                sender=sender,
                subject=subject,
                snippet=snippet,
                body=body,
                date=email_date,
                labels=labels_str  
            )
            
            # Handle optional is_read field
            if hasattr(Email, 'is_read'):
                email.is_read = "UNREAD" not in labels
            
            db.add(email)
            db.commit()
            db.refresh(email)
            
            saved_count += 1
            
            # Print progress every 50 emails
            if saved_count % 50 == 0:
                print(f" Progress: {saved_count}/{len(messages)} INBOX emails saved...")
        
        print(f" Fetched and saved {saved_count} new INBOX emails, skipped {skipped_count} existing")
        
        return saved_count
        
    except Exception as e:
        print(f" Error fetching all emails: {e}")
        import traceback
        traceback.print_exc()
        return 0


def mark_email_as_read(db, user_id: int, message_id: str) -> bool:
    """Mark an email as read in Gmail and update local DB."""
    try:
        service = get_gmail_service(db, user_id)
        
        # Remove UNREAD label in Gmail
        service.users().messages().modify(
            userId="me",
            id=message_id,
            body={"removeLabelIds": ["UNREAD"]}
        ).execute()
        
        # Update local database if is_read field exists
        email = db.query(Email).filter(
            Email.message_id == message_id,
            Email.user_id == user_id
        ).first()
        
        if email and hasattr(email, 'is_read'):
            email.is_read = True
            db.commit()
        
        print(f"Marked email {message_id} as read")
        return True
        
    except Exception as e:
        print(f" Error marking email as read: {e}")
        return False


def mark_email_as_unread(db, user_id: int, message_id: str) -> bool:
    """Mark an email as unread in Gmail and update local DB."""
    try:
        service = get_gmail_service(db, user_id)
        
        # Add UNREAD label in Gmail
        service.users().messages().modify(
            userId="me",
            id=message_id,
            body={"addLabelIds": ["UNREAD"]}
        ).execute()
        
        # Update local database if is_read field exists
        email = db.query(Email).filter(
            Email.message_id == message_id,
            Email.user_id == user_id
        ).first()
        
        if email and hasattr(email, 'is_read'):
            email.is_read = False
            db.commit()
        
        print(f" Marked email {message_id} as unread")
        return True
        
    except Exception as e:
        print(f" Error marking email as unread: {e}")
        return False


def delete_email(db, user_id: int, message_id: str) -> bool:
    """Delete an email from Gmail and local DB."""
    try:
        service = get_gmail_service(db, user_id)
        
        # Delete from Gmail
        service.users().messages().delete(
            userId="me",
            id=message_id
        ).execute()
        
        # Delete from local database
        email = db.query(Email).filter(
            Email.message_id == message_id,
            Email.user_id == user_id
        ).first()
        
        if email:
            db.delete(email)
            db.commit()
        
        print(f" Deleted email {message_id}")
        return True
        
    except Exception as e:
        print(f" Error deleting email: {e}")
        return False