# backend/routes/ai_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import pytz
from backend.services.summarize_emails import summarize_email
from backend.services.caption_emails import caption_email
from backend.services.calender import process_email, create_event

router = APIRouter(tags=["AI"])

# Pydantic models

class EmailRequest(BaseModel):
    email_text: str

class CalendarEventRequest(BaseModel):
    summary: str
    description: str
    start_time: str  
    end_time: str    
    creds_json: dict = None 


@router.post("/summarize")
def summarize_email_endpoint(request: EmailRequest):
    try:
        summary = summarize_email(request.email_text)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/caption")
def caption_email_endpoint(request: EmailRequest):
    try:
        caption = caption_email(request.email_text)
        return {"caption": caption}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-email-event")
def process_email_event_endpoint(request: EmailRequest):
    """
    Extract date/time from email and create Google Calendar event.
    """
    try:
        process_email(request.email_text) 
        return {"status": "Event processed (check Google Calendar)."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-event")
def create_calendar_event_endpoint(request: CalendarEventRequest):
    """
    Create event from provided summary/description/start/end times.
    """
    try:
        
        start_dt = datetime.fromisoformat(request.start_time)
        end_dt = datetime.fromisoformat(request.end_time)
        
        karachi_tz = pytz.timezone("Asia/Karachi")
        if start_dt.tzinfo is None:
            start_dt = karachi_tz.localize(start_dt)
        if end_dt.tzinfo is None:
            end_dt = karachi_tz.localize(end_dt)

        create_event(
            summary=request.summary,
            description=request.description,
            start_time=start_dt,
            end_time=end_dt
        )
        return {"status": "Event created successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

