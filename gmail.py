import os.path
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import streamlit as st
from dotenv import load_dotenv
from googleapiclient.errors import HttpError
from calender import process_email
from caption_emails import caption_email
from send_email import create_message, get_email_content, get_mime_message, send_message
from summarize_emails import summarize_email

load_dotenv()

# Define the Gmail/Calendar scopes
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]


def authenticate_gmail():
    # 1️⃣ Unique key per user session
    if "session_id" not in st.session_state:
        st.session_state.session_id = os.urandom(16).hex()

    user_key = f"creds_{st.session_state.session_id}"

    # 2️⃣ Return existing valid credentials
    if user_key in st.session_state:
        creds = st.session_state[user_key]

        if creds and creds.valid:
            return creds

        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                st.session_state[user_key] = creds
                return creds
            except:
                st.warning("Token refresh failed, please login again.")
                st.session_state.pop(user_key, None)

    # 3️⃣ Cloud-only redirect URI
    redirect_uri = "https://smart-email-engine-5khhar4st9jnt348hzba8.streamlit.app/oauth2callback"

    # 4️⃣ Load OAuth secrets
    client_id = st.secrets["google"]["client_id"]
    client_secret = st.secrets["google"]["client_secret"]

    # 5️⃣ Build OAuth flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        },
        scopes=SCOPES,
    )
    flow.redirect_uri = redirect_uri

    query_params = st.query_params

    # 6️⃣ First visit → Login button
    if "code" not in query_params:
        auth_url, _ = flow.authorization_url(
            prompt="consent",
            access_type="offline",
            include_granted_scopes="true",
        )
        st.link_button("🔐 Login with Google", auth_url)
        st.stop()

    # 7️⃣ OAuth Callback
    auth_code = query_params["code"]

    try:
        flow.fetch_token(code=auth_code)
        creds = flow.credentials

        st.session_state[user_key] = creds
        st.success("Logged in successfully!")

        st.query_params.clear()
        st.rerun()

    except Exception as e:
        st.error("Authentication failed")
        st.error(str(e))

        with st.expander("🔍 Full Error Traceback"):
            import traceback
            st.code(traceback.format_exc())

        with st.expander("🔧 Troubleshooting Tips"):
            st.write("1. Ensure redirect URI is added in Google Cloud Console:")
            st.code(redirect_uri)
            st.write("2. Ensure you are added as a Test User")
            st.write("3. Check your OAuth scope configuration")

        st.stop()

    return creds


    
def get_gmail_service():
    """Return Gmail API service object"""
    creds = authenticate_gmail()
    return build("gmail", "v1", credentials=creds)

def get_calendar_service():
    """Return Google Calendar API service object"""
    creds = authenticate_gmail()
    return build("calendar", "v3", credentials=creds)

def list_labels(service):
    """List Gmail labels for the authenticated user"""
    results = service.users().labels().list(userId="me").execute()
    labels = results.get("labels", [])
    if labels:
        print("Labels:")
        for label in labels:
            print(label["name"])
    else:
        print("No labels found.")

def send_test_email(service, sender, recipient):
    """Send a test email"""
    msg = create_message(
        sender=sender,
        to=recipient,
        subject="Test Gmail API",
        message_text="Hello from Python Gmail API!"
    )
    send_message(service, "me", msg)

def fetch_latest_email(service):
    """Fetch latest email from inbox and return content"""
    results = service.users().messages().list(userId='me', maxResults=1, labelIds=['INBOX']).execute()
    messages = results.get('messages', [])
    if not messages:
        print("No new messages.")
    else:
        latest_msg_id = messages[0]['id']
        mime_msg = get_mime_message(service, "me", latest_msg_id)
        if mime_msg:
            content = get_email_content(mime_msg)
            print("Original email: \n",content)
            caption = caption_email(content)
            print("Email Caption: \n",caption)
            summary = summarize_email(content)
            print("Summarized email: \n",summary)
            process_email(content)

def process_latest_email(service):
    """Fetch, summarize, and process the latest email"""
    content = fetch_latest_email(service)
    if content:
        print("Original email:\n", content)
        summary = summarize_email(content)
        print("Summarized email:\n", summary)
        process_email(content)

def main():
    creds = authenticate_gmail()
    try:
        service = build("gmail", "v1", credentials=creds)
        list_labels(service)
        send_test_email(service, sender="toobaanwar240@gmail.com", recipient="toobaanwar240@gmail.com")
        process_latest_email(service)
    except HttpError as error:
        print(f"An error occurred: {error}")

if __name__ == "__main__":
    main()
