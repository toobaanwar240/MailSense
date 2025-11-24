import streamlit as st
from googleapiclient.discovery import build
import re
from send_email import (
    get_messages,
    get_mime_message,
    get_email_content,
    send_message,
    create_message
)
from gmail import authenticate_gmail
from summarize_emails import summarize_email
from calender import process_email
from caption_emails import caption_email
from email_processor import preprocess_email

st.set_page_config(page_title="Gmail AI Assistant", layout="wide")
st.title("📧 Gmail AI Assistant")

# --- Step 1: Authentication ---
# The authenticate_gmail() function handles the entire login UI
# No need to create manual buttons - it will show the login button automatically
creds = authenticate_gmail()

# If we reach here, user is authenticated
# Build the Gmail service
service = build("gmail", "v1", credentials=creds)

# --- Step 2: Fetch latest emails ---
if st.button("Fetch Latest Emails"):
    with st.spinner("Fetching your emails..."):
        messages_data = get_messages(service, "me")
        if messages_data.get("messages"):
            email_list = []
            for msg in messages_data["messages"][:5]:  # fetch top 5 emails
                mime_msg = get_mime_message(service, "me", msg["id"])
                content = get_email_content(mime_msg)
                # Store both original and processed content
                processed_content = preprocess_email(content, max_tokens=5000)
                email_list.append({
                    "id": msg["id"], 
                    "content": processed_content, 
                    "original_content": content
                })
            st.session_state["email_list"] = email_list
            st.session_state["selected_email_index"] = 0  # Auto-select first email
            st.success(f"Fetched {len(email_list)} emails!")
            st.rerun()  # Refresh to show the emails immediately
        else:
            st.warning("No emails found.")

# --- Step 3: Select an email to view ---
if st.session_state.get("email_list"):
    st.subheader("📄 Select an Email to View")
    selected_index = st.selectbox(
        "Choose an email",
        options=list(range(len(st.session_state["email_list"]))),
        format_func=lambda x: st.session_state["email_list"][x]["content"][:50] + "...",
        key="email_selector"
    )
    
    # Update selected email when user changes selection
    if selected_index != st.session_state.get("selected_email_index", -1):
        st.session_state["selected_email_index"] = selected_index
        # Clear previous summaries when email changes
        if "summary" in st.session_state:
            del st.session_state["summary"]
        if "caption" in st.session_state:
            del st.session_state["caption"]
        st.rerun()
    
    selected_email = st.session_state["email_list"][selected_index]["content"]
    original_email = st.session_state["email_list"][selected_index]["original_content"]
    
    st.text_area("Email Content",selected_email,height=200,key=f"email_content_display_{selected_index}")

    summary_key = f"summary_{selected_index}"
    caption_key = f"caption_{selected_index}"

    # --- Step 4: Automatic Summarization ---
    st.subheader("📝 Email Summary")


    summary_key = f"summary_{selected_index}"
    
    if summary_key not in st.session_state:
        with st.spinner("Generating summary automatically..."):
            try:
                summary = summarize_email(original_email)
                st.session_state[summary_key] = summary
            except Exception as e:
                st.session_state[summary_key] = "Summary unavailable"
    
    st.text_area("Summary", st.session_state[summary_key], height=150)

    # --- Step 5: Automatic Caption Generation ---
    st.subheader("🏷️ Email Caption")
    caption_key = f"caption_{selected_index}"

    if caption_key not in st.session_state:
        with st.spinner("Generating caption automatically..."):
            try:
                caption = caption_email(original_email)
                st.session_state[caption_key] = caption
            except Exception as e:
                st.session_state[caption_key] = "Caption unavailable"
    
    st.text_area("Caption", st.session_state[caption_key], height=100)

    # --- Step 6: Manual Actions (Optional) ---
    with st.expander("🛠️ Manual Actions (Optional)"):
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("🔄 Regenerate Summary"):
                with st.spinner("Regenerating summary..."):
                    try:
                        summary = summarize_email(original_email)
                        st.session_state["summary"] = summary
                        st.session_state["summary_email"] = summary
                        st.success("Summary regenerated!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Summarization failed: {e}")
        
        with col2:
            if st.button("🔄 Regenerate Caption"):
                with st.spinner("Regenerating caption..."):
                    try:
                        caption = caption_email(original_email)
                        st.session_state["caption"] = caption
                        st.success("Caption regenerated!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Caption generation failed: {e}")

        # Calendar event extraction (still manual since it modifies calendar)
        st.subheader("📅 Calendar Event")
        if st.button("Extract Event from Email"):
            with st.spinner("Processing calendar event..."):
                try:
                    process_email(original_email)
                    st.success("Event processed and added to Calendar!")
                except Exception as e:
                    st.error(f"❌ Calendar processing failed: {e}")

    # --- Step 7: Compose & Send Email ---
    st.subheader("✉️ Compose & Send Email")
    recipient = st.text_input("Recipient Email", "", key="recipient_input")
    subject = st.text_input("Subject", "Re: Meeting", key="subject_input")
    body = st.text_area("Body", value=st.session_state.get("summary_email", ""), height=200, key="body_input")

    if st.button("Send Email", key="send_button"):
        if not recipient.strip():
            st.error("Please enter a recipient email address.")
        elif not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", recipient):
            st.error("Please enter a valid email address.")
        else:
            try:
                msg = create_message(
                    sender="me",
                    to=recipient,
                    subject=subject,
                    message_text=body
                )
                send_message(service, "me", msg)
                st.success(f"✅ Email successfully sent to {recipient}!")
            except Exception as e:
                st.error(f"❌ Failed to send email: {e}")
