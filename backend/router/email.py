from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from groq import BaseModel
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db.gmail_service import fetch_user_emails, get_gmail_service
from backend.db.models import Email, User
from backend.RAG.rag_service import rag_system
from backend.services.send_email import get_mime_message, get_email_content, create_message, send_message
from backend.router.dependencies import get_current_user

router = APIRouter(tags=["Email"])

class RAGQuestionRequest(BaseModel):
    question: str


# Endpoint to start background sync
@router.post("/sync/background")
def start_background_sync(
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Schedule the fetch_user_emails task
    background_tasks.add_task(fetch_user_emails, db, current_user.id)
    return {"status": "Background sync started"}

# Sync inbox for the logged-in user

@router.post("/sync")
def sync_inbox(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetch unread emails, store snippet + body in DB (if not exists)
    """
    try:
        service = get_gmail_service(db, current_user.id)
        response = service.users().messages().list(
            userId="me",
            labelIds=["INBOX", "UNREAD"],
            maxResults=50
        ).execute()

        messages = response.get("messages", [])
        saved_count = 0

        for msg in messages:
            # skip if already in DB
            exists = db.query(Email).filter(
                Email.user_id == current_user.id,
                Email.message_id == msg["id"]
            ).first()
            if exists:
                continue

            # fetch metadata + snippet
            msg_data = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="metadata",
                metadataHeaders=["From", "Subject"]
            ).execute()

            headers = msg_data.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "")
            snippet = msg_data.get("snippet", "")

            # fetch full body using MIME parser
            mime_msg = get_mime_message(service, "me", msg["id"])
            body = get_email_content(mime_msg) if mime_msg else ""

            email_db = Email(
                user_id=current_user.id,
                message_id=msg["id"],
                sender=sender,
                subject=subject,
                snippet=snippet,
                body=body
            )
            db.add(email_db)
            db.commit()  # ✨ Commit before ingesting
            db.refresh(email_db)  #  Refresh to get the ID
            
            #  INGEST INTO VECTOR STORE
            saved_count += 1

        return {"status": "Inbox synced", "emails_fetched": saved_count}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



#  List unread emails (snippet only)

@router.get("/list")
def list_unread_emails(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    max_results: int = 10
):
    """
    Returns unread emails (snippet only) for the logged-in user.
    """
    try:
        emails = (
            db.query(Email)
            .filter(Email.user_id == current_user.id)
            .order_by(Email.date.desc())  # ✅ CHANGED: date instead of id
            .limit(max_results)
            .all()
        )

        email_list = []
        for e in emails:
            email_list.append({
                "id": e.message_id,
                "sender": e.sender,
                "subject": e.subject,
                "snippet": e.snippet,
                "body": e.body,
                "date": str(e.date),  # ✅ ADDED: Include date in response
                "is_read": e.is_read if hasattr(e, 'is_read') else None  # ✅ ADDED: Include read status
            })

        return {"emails": email_list, "count": len(email_list)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#  Read a specific email (fetch body on demand)

@router.get("/read/{msg_id}")
def read_email(
    msg_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch full email body for a single email and save to DB
    """
    try:
        service = get_gmail_service(db, current_user.id)
        mime_msg = get_mime_message(service, "me", msg_id)
        if not mime_msg:
            raise HTTPException(status_code=404, detail="Email not found")

        body = get_email_content(mime_msg)

        email_db = db.query(Email).filter(
            Email.user_id == current_user.id,
            Email.message_id == msg_id
        ).first()
        if email_db:
            email_db.body = body
            db.commit()

        return {"id": msg_id, "body": body}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



#  Send email

@router.post("/send")
def send_email(
    to: str,
    subject: str,
    body: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        service = get_gmail_service(db, current_user.id)
        message = create_message("me", to, subject, body)
        result = send_message(service, "me", message)
        return {"id": result["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

 
#================ RAG =================

@router.post("/rag/index")
def rag_index(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Index all emails for RAG."""
    return rag_system.index_user_emails(db, current_user.email)


@router.post("/rag/ask")
def rag_ask(
    request: RAGQuestionRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask questions about emails using RAG."""
    return rag_system.answer_question(current_user, request.question, db=db)

@router.get("/rag/stats")
def rag_stats(current_user: str = Depends(get_current_user)):
    """Get RAG statistics."""
    return rag_system.get_stats(current_user)

# ================= ADMIN =================

@router.get("/admin/status")
def admin_status(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get system status."""
    user = db.query(User).filter(User.email_address == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    all_emails = db.query(Email).filter(Email.user_id == user.id).all()
    unread = [e for e in all_emails if not e.is_read]
    read = [e for e in all_emails if e.is_read]

    return {
        "user": {
            "email": current_user,
            "name": user.name
        },
        "database": {
            "total_emails": len(all_emails),
            "unread_emails": len(unread),
            "read_emails": len(read)
        },
        "rag": rag_system.get_stats(current_user)
    }
