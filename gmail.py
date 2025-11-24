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

# Google scopes
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]

# -------------------------
# AUTHENTICATION
# -------------------------
def authenticate_gmail():
    if "session_id" not in st.session_state:
        st.session_state.session_id = os.urandom(16).hex()

    user_key = f"creds_{st.session_state.session_id}"

    # Return existing valid credentials
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

    # Redirect URL for Streamlit Cloud
    redirect_uri = "https://smart-email-engine-5khhar4st9jnt348hzba8.streamlit.app/oauth2callback"

    # Load OAuth secrets
    client_id = st.secrets["google"]["client_id"]
    client_secret = st.secrets["google"]["client_secret"]

    # Build OAuth flow
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

    # First visit → show login button
    if "code" not in query_params:
        auth_url, _ = flow.authorization_url(
            prompt="consent",
            access_type="offline",
            include_granted_scopes="true",
        )
        st.link_button("🔐 Login with Google", auth_url)
        st.stop()

    # OAuth callback
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

        st.stop()

    return creds

# -------------------------
# SERVICES
# -------------------------

def get_gmail_service():
    creds = authenticate_gmail()
    return build("gmail", "v1", credentials=creds)

def get_calendar_service():
    creds = authenticate_gmail()
    return build("calendar", "v3", credentials=creds)

# -------------------------
# FETCH UNREAD EMAILS
# -------------------------

def fetch_latest_unread_emails(service, max_results=5):
    """
    Fetch the latest unread emails from Gmail (limit max_results)
    """
    try:
        response = service.users().messages().list(
            userId="me",
            labelIds=["UNREAD"],
            maxResults=max_results,
            q="is:unread",
            orderBy="date"
        ).execute()

        messages = response.get("messages", [])
        email_list = []

        for msg in messages:
            msg_id = msg["id"]

            mime_msg = get_mime_message(service, "me", msg_id)
            if not mime_msg:
                continue

            content = get_email_content(mime_msg)

            email_list.append({
                "id": msg_id,
                "content": content
            })

        return email_list

    except Exception as e:
        print("Error fetching unread emails:", e)
        return []


# -------------------------
# MAIN FUNCTION
# -------------------------

def main():
    creds = authenticate_gmail()

    try:
        service = build("gmail", "v1", credentials=creds)

        # Fetch latest 5 unread emails
        unread_emails = fetch_latest_unread_emails(service, max_results=5)

        if not unread_emails:
            print("No unread emails found.")
            return

        print(f"📩 Fetched {len(unread_emails)} unread emails.\n")

        for i, email_data in enumerate(unread_emails, start=1):
            content = email_data["content"]
            msg_id = email_data["id"]

            print(f"\n------ EMAIL #{i} (ID: {msg_id}) ------")
            print("Original Content:\n", content)

            caption = caption_email(content)
            print("\nCaption:\n", caption)

            summary = summarize_email(content)
            print("\nSummary:\n", summary)

            process_email(content)

            # Optional: Mark email as READ
            service.users().messages().modify(
                 userId="me",
                 id=msg_id,
                 body={"removeLabelIds": ["UNREAD"]}
            ).execute()

    except HttpError as error:
        print(f"An error occurred: {error}")


# -------------------------
# RUN
# -------------------------
if __name__ == "__main__":
    main()
