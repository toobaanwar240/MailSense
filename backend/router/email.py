from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from groq import BaseModel
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db.gmail_service import fetch_user_emails, get_gmail_service
from backend.db.models import Email, User
from backend.RAG.rag_service import rag_system
from backend.services.send_email import get_mime_message, get_email_content, create_message, send_message
from backend.router.dependencies import get_current_user
from sqlalchemy import nullslast

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
    Fetch unread emails, storing snippet + body in DB with full labels and dates
    """
    try:
        saved_count = fetch_user_emails(db, current_user.id, max_results=100)
        return {"status": "Inbox synced", "emails_fetched": saved_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



#  List unread emails (snippet only)

@router.get("/list")
def list_unread_emails(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    max_results: int = 10,
    limit: int = None,
    is_read: bool = None
):
    """
    Returns emails for the logged-in user with optional limit and read/unread filtering.
    """
    try:
        # Dynamic self-healing migration: Update legacy NULL labels to "INBOX,UNREAD"
        legacy_emails = db.query(Email).filter(Email.user_id == current_user.id, Email.labels.is_(None)).all()
        if legacy_emails:
            for le in legacy_emails:
                le.labels = "INBOX,UNREAD"
            db.commit()

        final_limit = limit if limit is not None else max_results
        query = db.query(Email).filter(Email.user_id == current_user.id)
        
        if is_read is not None:
            if hasattr(Email, 'is_read'):
                query = query.filter(Email.is_read == is_read)
            elif hasattr(Email, 'labels'):
                if is_read:
                    query = query.filter(Email.labels.is_not(None), ~Email.labels.contains("UNREAD"))
                else:
                    from sqlalchemy import or_
                    query = query.filter(or_(Email.labels.contains("UNREAD"), Email.labels.is_(None)))

        emails = (
            query
            .order_by(nullslast(Email.date.desc()), Email.id.desc())
            .limit(final_limit)
            .all()
        )

        email_list = []
        for e in emails:
            is_read_val = True
            if hasattr(e, 'is_read') and e.is_read is not None:
                is_read_val = e.is_read
            elif hasattr(e, 'labels') and e.labels is not None:
                is_read_val = "UNREAD" not in e.labels
            else:
                is_read_val = False  # Default to False (unread) if labels are completely NULL/None

            email_list.append({
                "id": e.message_id,
                "sender": e.sender,
                "subject": e.subject,
                "snippet": e.snippet,
                "body": e.body,
                "date": str(e.date),  
                "is_read": is_read_val  
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
    Fetch full email body for a single email, save to DB, and mark as read.
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
            
            # Update read status in local database
            if hasattr(email_db, 'is_read'):
                email_db.is_read = True
            if hasattr(email_db, 'labels') and email_db.labels is not None:
                labels_list = [l.strip() for l in email_db.labels.split(',') if l.strip()]
                if "UNREAD" in labels_list:
                    labels_list.remove("UNREAD")
                email_db.labels = ",".join(labels_list)
            
            db.commit()

        # Mark as read in Gmail
        try:
            service.users().messages().modify(
                userId="me",
                id=msg_id,
                body={"removeLabelIds": ["UNREAD"]}
            ).execute()
        except Exception as gmail_err:
            print(f"Failed to remove UNREAD label in Gmail: {gmail_err}")

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

 
#RAG 

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

# ADMIN 
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