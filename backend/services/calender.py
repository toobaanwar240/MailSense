from datetime import datetime, timedelta,timezone
import os
import re
import pytz
import groq as Groq
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from dotenv import load_dotenv
import os
import streamlit as st

# Load variables from .env file
load_dotenv()
# Get API key from environment variable
GROQ_API_KEY = st.secrets["groq"]["api_key"] if "groq" in st.secrets else os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("Groq API key not found in .env or Streamlit secrets.")

# Initialize Groq client
client = Groq.Client(api_key=GROQ_API_KEY)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
client = Groq.Client(api_key=GROQ_API_KEY)
DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2,
    "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
}

def extract_date_time_from_email(text):
    """Use Groq model to extract date/time from email."""
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "Extract date and time from emails clearly."},
            {"role": "user", "content": f"Extract date and time:\n{text}"}
        ]
    )
    return response.choices[0].message.content


def get_calendar_service():
    """Return Google Calendar API service using same Gmail OAuth credentials."""
    creds = st.session_state.get("creds") or st.session_state.get(f"creds_{st.session_state.session_id}")
    
    if not creds:
        st.error("No credentials found. Please log in again.")
        st.stop()

    return build("calendar", "v3", credentials=creds)

def create_event(summary, description, start_time, end_time):
    service = get_calendar_service()
    karachi_tz = pytz.timezone("Asia/Karachi")

    # Ensure start_time and end_time are in Asia/Karachi
    if start_time.tzinfo is None:
        start_time = karachi_tz.localize(start_time)
    else:
        start_time = start_time.astimezone(karachi_tz)

    if end_time.tzinfo is None:
        end_time = karachi_tz.localize(end_time)
    else:
        end_time = end_time.astimezone(karachi_tz)

    # Create the event dictionary
    event = {
        "summary": summary,
        "description": description,
        "start": {
            "dateTime": start_time.isoformat(),
            "timeZone": "Asia/Karachi",
        },
        "end": {
            "dateTime": end_time.isoformat(),
            "timeZone": "Asia/Karachi",
        },
    }

    event_result = service.events().insert(calendarId="primary", body=event).execute()
    print(f"Event created: {event_result.get('htmlLink')}")

def process_email(email_text):
    extracted = extract_date_time_from_email(email_text)
    print("\nExtracted date/time info:\n", extracted)

    # Try regex for numeric or text-based date
    date_match = re.search(r"\d{4}-\d{2}-\d{2}", extracted)
    time_match = re.search(r"(\d{1,2}):(\d{2}) ?(AM|PM|am|pm)?", extracted)
    text_date_match = re.search(r"([A-Za-z]+ \d{1,2}, \d{4})", extracted)

    # Handle weekday names
    if not date_match and not text_date_match:
        for day_name, weekday_num in DAY_MAP.items():
            if day_name in extracted.lower():
                today = datetime.now(tz=pytz.timezone("Asia/Karachi"))  # Use Karachi timezone
                days_ahead = (weekday_num - today.weekday() + 7) % 7
                if days_ahead == 0:
                    days_ahead = 7
                target_date = today + timedelta(days=days_ahead)
                date_str = target_date.strftime("%Y-%m-%d")
                break
    else:
        # Get date string
        if date_match:
            date_str = date_match.group()
        elif text_date_match:
            dt = datetime.strptime(text_date_match.group(), "%B %d, %Y")
            date_str = dt.strftime("%Y-%m-%d")

    if (date_match or text_date_match or 'date_str' in locals()) and time_match:
        # Handle time (AM/PM)
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
        if time_match.group(3) and time_match.group(3).lower() == "pm" and hour != 12:
            hour += 12
        if time_match.group(3) and time_match.group(3).lower() == "am" and hour == 12:
            hour = 0

        # Combine into full ISO datetime
        time_str = f"{hour:02d}:{minute:02d}"
        start_str = f"{date_str}T{time_str}:00"

        # Create event times in Karachi timezone
        karachi_tz = pytz.timezone("Asia/Karachi")
        start_time = datetime.fromisoformat(start_str)
        start_time = karachi_tz.localize(start_time)  # Localize to Karachi
        end_time = start_time + timedelta(hours=1)

        # Create event
        create_event(
            summary="Meeting from Email",
            description=email_text[:150] + "...",
            start_time=start_time,
            end_time=end_time,
        )
    else:
        print("Could not find valid date/time in email.")

