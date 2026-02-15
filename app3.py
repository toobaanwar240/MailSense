"""
Smart Email Engine - FIXED INBOX CONTENT DISPLAY
✅ Email content now shows properly
✅ Better error handling
✅ Debug info
"""

import streamlit as st
import requests
import re
from streamlit_autorefresh import st_autorefresh

API_BASE_URL = "http://localhost:8000"

st.set_page_config(page_title="Gmail AI Assistant", page_icon="📧", layout="wide")

# ========================
# Session State Initialization
# ========================
if "token" not in st.session_state:
    st.session_state.token = None
if "user_email" not in st.session_state:
    st.session_state.user_email = None
if "rag_results" not in st.session_state:
    st.session_state.rag_results = None
if "rag_question" not in st.session_state:
    st.session_state.rag_question = None
if "emails" not in st.session_state:
    st.session_state.emails = []
if "selected_index" not in st.session_state:
    st.session_state.selected_index = 0
if "sync_started" not in st.session_state:
    st.session_state.sync_started = False
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# ========================
# Helper Functions
# ========================
def highlight_keywords(text: str, keywords: list) -> str:
    """Highlight keywords in red."""
    if not text:
        return ""
    for kw in keywords:
        if len(kw) > 2:
            pattern = re.compile(re.escape(kw), re.IGNORECASE)
            text = pattern.sub(f"**🔴{kw.upper()}🔴**", text)
    return text

def get_headers():
    """Get authorization headers"""
    return {"Authorization": f"Bearer {st.session_state.token}"}

# ------------------------
# 1️⃣ Login with Google
# ------------------------
st.title("📧 Gmail AI Assistant")

query_params = st.query_params

if "token" in query_params:
    st.session_state.token = str(query_params["token"])
    if "email" in query_params:
        st.session_state.user_email = str(query_params["email"])

if not st.session_state.token:
    st.subheader("Welcome! Please login to continue.")
    st.markdown("### [🔐 Login with Google](http://localhost:8000/auth/login)")
    st.info("Click the link above to authenticate with your Google account")
    st.stop()

headers = get_headers()

# ------------------------
# SIDEBAR
# ------------------------
st.sidebar.header("🔍 Email Search Index")

try:
    status_resp = requests.get(
        f"{API_BASE_URL}/rag/admin/status",
        headers=headers,
        timeout=5
    )
    if status_resp.status_code == 200:
        status_data = status_resp.json()
        db_stats = status_data.get("database", {})
        rag_stats = status_data.get("rag", {})
        
        st.sidebar.metric("Total Emails", db_stats.get("total_emails", 0))
        st.sidebar.metric("Unread", db_stats.get("unread_emails", 0))
        st.sidebar.metric("Indexed", rag_stats.get("indexed_emails", 0))
except:
    pass

if st.sidebar.button("🔄 Index Emails", use_container_width=True):
    with st.sidebar:
        with st.spinner("Indexing..."):
            try:
                resp = requests.post(f"{API_BASE_URL}/rag/index", headers=headers, timeout=120)
                if resp.status_code == 200:
                    st.success("✅ Indexing complete!")
                    st.rerun()
                else:
                    st.error(f"Failed: {resp.text}")
            except Exception as e:
                st.error(f"Error: {e}")

st.sidebar.divider()
if st.session_state.user_email:
    st.sidebar.write(f"👤 {st.session_state.user_email}")

if st.sidebar.button("🚪 Logout", use_container_width=True):
    st.session_state.clear()
    st.rerun()

# ------------------------
# TABS
# ------------------------
tabs = st.tabs(["📬 Inbox", "💬 Chat Assistant", "🔍 Search Results", "✉️ Compose"])

# ============ TAB 1: INBOX (FIXED) ============
with tabs[0]:
    st.header("Your Inbox")
    
    # Refresh button
    if st.button("🔄 Refresh Emails", key="refresh_inbox"):
        st.session_state.emails = []
        st.rerun()
    
    # Fetch emails
    try:
        resp = requests.get(f"{API_BASE_URL}/email/list", headers=headers, timeout=10)
        if resp.status_code == 200:
            new_emails = resp.json().get("emails", [])
            
            # Debug info
            st.caption(f"📊 API returned {len(new_emails)} emails")
            
            # Replace emails list instead of appending
            if new_emails:
                st.session_state.emails = new_emails
        else:
            st.error(f"Failed to fetch emails: {resp.status_code}")
            
    except Exception as e:
        st.error(f"Error fetching emails: {e}")

    emails = st.session_state.emails
    
    if not emails:
        st.info("No emails loaded yet. Click 'Refresh Emails' to load.")
        st.stop()
    
    # Email selector with better key handling
    st.subheader(f"📧 {len(emails)} Emails Available")
    
    # Create email options with more info
    email_options = []
    for idx, email in enumerate(emails):
        subject = email.get('subject', 'No Subject')
        sender = email.get('sender', 'Unknown')
        date = email.get('date', 'Unknown')
        
        # Truncate for display
        subject_short = subject[:40] + "..." if len(subject) > 40 else subject
        sender_short = sender.split('<')[0].strip() if '<' in sender else sender[:20]
        
        email_options.append(f"{idx+1}. {subject_short} - {sender_short}")
    
    # Email selector
    selected_index = st.selectbox(
        "Select Email to View",
        options=list(range(len(emails))),
        format_func=lambda x: email_options[x],
        key="email_selector"
    )
    
    # Update session state
    st.session_state.selected_index = selected_index
    
    # Get selected email
    selected_email = emails[selected_index]
    
    # Debug: Show what we got
    st.caption(f"Selected email ID: {selected_email.get('id', 'N/A')}")
    
    # Display email details
    st.divider()
    st.subheader("📧 Email Details")
    
    # Header info
    col1, col2 = st.columns([2, 1])
    with col1:
        st.markdown(f"**Subject:** {selected_email.get('subject', 'No Subject')}")
        st.markdown(f"**From:** {selected_email.get('sender', 'Unknown')}")
    with col2:
        st.markdown(f"**Date:** {selected_email.get('date', 'Unknown')}")
        if selected_email.get('is_read') == False:
            st.markdown("**Status:** 🔵 Unread")
        else:
            st.markdown("**Status:** ✓ Read")
    
    st.divider()
    
    # Get email content with fallback
    email_content = (
        selected_email.get("body") or 
        selected_email.get("snippet") or 
        selected_email.get("text") or
        "No content available"
    )
    
    # Debug: Show content length
    st.caption(f"Content length: {len(email_content)} characters")
    
    # Display content in expandable area
    st.markdown("**📄 Email Content:**")
    
    # Use markdown instead of text_area for better display
    with st.expander("View Full Content", expanded=True):
        if email_content and email_content != "No content available":
            # Show content in a nice format
            st.markdown(email_content)
        else:
            st.warning("⚠️ This email has no content available")
            
            # Show raw email data for debugging
            if st.checkbox("Show raw email data (debug)", key="debug_raw"):
                st.json(selected_email)

    # Action buttons
    st.divider()
    st.markdown("**🛠️ Actions:**")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.button("📝 Summarize", use_container_width=True, key="inbox_sum"):
            if not email_content or email_content == "No content available":
                st.error("Cannot summarize - no content available")
            else:
                with st.spinner("Generating summary..."):
                    try:
                        resp = requests.post(
                            f"{API_BASE_URL}/ai/summarize",
                            json={"email_text": email_content},
                            headers=headers,
                            timeout=30
                        )
                        if resp.status_code == 200:
                            summary = resp.json().get("summary", "No summary returned")
                            st.success("✅ Summary:")
                            st.info(summary)
                        else:
                            st.error(f"Error: {resp.text}")
                    except Exception as e:
                        st.error(f"Error: {e}")

    with col2:
        if st.button("🏷️ Caption", use_container_width=True, key="inbox_cap"):
            if not email_content or email_content == "No content available":
                st.error("Cannot generate caption - no content available")
            else:
                with st.spinner("Generating caption..."):
                    try:
                        resp = requests.post(
                            f"{API_BASE_URL}/ai/caption",
                            json={"email_text": email_content},
                            headers=headers,
                            timeout=30
                        )
                        if resp.status_code == 200:
                            caption = resp.json().get("caption", "No caption returned")
                            st.success("✅ Caption:")
                            st.info(caption)
                        else:
                            st.error(f"Error: {resp.text}")
                    except Exception as e:
                        st.error(f"Error: {e}")

    with col3:
        if st.button("📅 Calendar", use_container_width=True, key="inbox_cal"):
            if not email_content or email_content == "No content available":
                st.error("Cannot create event - no content available")
            else:
                with st.spinner("Creating calendar event..."):
                    try:
                        resp = requests.post(
                            f"{API_BASE_URL}/ai/process-email-event",
                            json={"email_text": email_content},
                            headers=headers,
                            timeout=30
                        )
                        if resp.status_code == 200:
                            st.success("✅ Event created!")
                        else:
                            st.error(f"Error: {resp.text}")
                    except Exception as e:
                        st.error(f"Error: {e}")

# ============ TAB 2: CHAT ASSISTANT ============
with tabs[1]:
    st.header("💬 Chat with Your Emails")
    
    st.markdown("""
    Ask me anything about your emails! I can:
    - Find specific emails
    - Summarize conversations
    - Identify urgent items
    - Find deadlines
    - Search by sender or topic
    """)
    
    # Chat input at the top
    user_question = st.text_input(
        "Ask me about your emails",
        placeholder="e.g., What are my upcoming deadlines?",
        key="chat_input"
    )
    
    col1, col2 = st.columns([1, 5])
    with col1:
        ask_button = st.button("💬 Ask", type="primary", use_container_width=True)
    with col2:
        if st.session_state.chat_history:
            if st.button("🗑️ Clear History", use_container_width=True):
                st.session_state.chat_history = []
                st.rerun()
    
    # Handle question
    if ask_button and user_question.strip():
        with st.spinner("Thinking..."):
            try:
                resp = requests.post(
                    f"{API_BASE_URL}/rag/ask",
                    json={"question": user_question},
                    headers=headers,
                    timeout=60
                )
                
                if resp.status_code == 200:
                    result = resp.json()
                    answer = result.get('answer', 'No answer')
                    
                    # Add to chat history
                    st.session_state.chat_history.append({
                        "question": user_question,
                        "answer": answer,
                        "sources": result.get('sources', [])
                    })
                    st.rerun()
                else:
                    st.error(f"Error: {resp.text}")
            except Exception as e:
                st.error(f"Error: {e}")
    
    # Display chat history
    st.divider()
    
    if not st.session_state.chat_history:
        st.info("👋 Ask me a question to get started!")
    else:
        st.subheader(f"Conversation ({len(st.session_state.chat_history)} messages)")
        
        # Display in reverse order (newest first)
        for i, chat in enumerate(reversed(st.session_state.chat_history)):
            idx = len(st.session_state.chat_history) - i
            
            with st.container():
                # Question
                st.markdown(f"**🙋 You ({idx}):**")
                st.write(chat['question'])
                
                # Answer
                st.markdown(f"**🤖 Assistant:**")
                st.info(chat['answer'])
                
                # Show sources count
                sources = chat.get('sources', [])
                if sources:
                    st.caption(f"📚 Based on {len(sources)} emails")
                    
                    # Option to view sources
                    if st.button(f"View {len(sources)} source emails", key=f"sources_{idx}"):
                        st.session_state.rag_results = {
                            'answer': chat['answer'],
                            'sources': sources
                        }
                        st.session_state.rag_question = chat['question']
                        st.success("👉 View sources in the 'Search Results' tab")
                
                if i < len(st.session_state.chat_history) - 1:
                    st.markdown("---")

# ============ TAB 3: SEARCH RESULTS ============
with tabs[2]:
    st.header("🔍 Detailed Search Results")
    
    if not st.session_state.rag_results:
        st.info("No search results yet. Use the Chat Assistant to ask questions!")
    else:
        result = st.session_state.rag_results
        question = st.session_state.rag_question or "Previous search"
        keywords = [w for w in question.lower().split() if len(w) > 2]
        
        st.markdown(f"### Question: *{question}*")
        
        answer_text = result.get('answer', 'No answer')
        sources = result.get('sources', [])
        
        if sources:
            st.success(f"✅ Found {len(sources)} matching emails")
        else:
            st.warning("No emails found")
        
        st.info(answer_text)
        
        if sources:
            st.divider()
            st.markdown(f"### 📚 {len(sources)} Source Emails")
            sources = sorted(sources, key=lambda x: x.get('relevance', 0), reverse=True)
            
            for i, src in enumerate(sources, 1):
                email_id = src.get('email_id')
                if not email_id:
                    continue
                
                with st.container():
                    relevance = src.get('relevance', 0)
                    st.markdown(f"#### #{i} - {src.get('subject', 'No Subject')} (Match: {relevance}%)")
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        st.write(f"**From:** {src.get('sender', 'Unknown')}")
                    with col2:
                        st.write(f"**Date:** {src.get('date', 'Unknown')}")
                    
                    if src.get('is_urgent'):
                        st.error("🔴 URGENT")
                    if src.get('has_deadline') and src.get('deadline') != 'None':
                        st.warning(f"⏰ Deadline: {src.get('deadline')}")
                    
                    # Show/Hide content
                    show_key = f"show_{i}"
                    if show_key not in st.session_state:
                        st.session_state[show_key] = (i <= 3)
                    
                    if st.button(
                        "▼ Show Content" if not st.session_state[show_key] else "▲ Hide Content",
                        key=f"toggle_{i}"
                    ):
                        st.session_state[show_key] = not st.session_state[show_key]
                        st.rerun()
                    
                    if st.session_state[show_key]:
                        full_content = src.get('text', '')
                        highlighted = highlight_keywords(full_content, keywords)
                        
                        st.markdown("**📄 Content:**")
                        st.markdown(highlighted)
                        st.divider()
                        
                        # Tools
                        st.markdown("**🛠️ Tools:**")
                        t1, t2, t3 = st.columns(3)
                        
                        with t1:
                            if st.button("📝 Summarize", key=f"sum_{i}", use_container_width=True):
                                with st.spinner("..."):
                                    try:
                                        r = requests.post(
                                            f"{API_BASE_URL}/ai/summarize",
                                            json={"email_text": full_content},
                                            headers=headers,
                                            timeout=30
                                        )
                                        if r.status_code == 200:
                                            st.success("✅ Summary:")
                                            st.info(r.json().get('summary'))
                                        else:
                                            st.error(f"Error: {r.text}")
                                    except Exception as e:
                                        st.error(f"Error: {e}")
                        
                        with t2:
                            if st.button("🏷️ Caption", key=f"cap_{i}", use_container_width=True):
                                with st.spinner("..."):
                                    try:
                                        r = requests.post(
                                            f"{API_BASE_URL}/ai/caption",
                                            json={"email_text": full_content},
                                            headers=headers,
                                            timeout=30
                                        )
                                        if r.status_code == 200:
                                            st.success("✅ Caption:")
                                            st.info(r.json().get('caption'))
                                        else:
                                            st.error(f"Error: {r.text}")
                                    except Exception as e:
                                        st.error(f"Error: {e}")
                        
                        with t3:
                            if st.button("📅 Event", key=f"evt_{i}", use_container_width=True):
                                with st.spinner("..."):
                                    try:
                                        r = requests.post(
                                            f"{API_BASE_URL}/ai/process-email-event",
                                            json={"email_text": full_content},
                                            headers=headers,
                                            timeout=30
                                        )
                                        if r.status_code == 200:
                                            st.success("✅ Event created!")
                                        else:
                                            st.error(f"Error: {r.text}")
                                    except Exception as e:
                                        st.error(f"Error: {e}")
                    
                    st.markdown("---")
        
        if st.button("🗑️ Clear Results", key="clear"):
            st.session_state.rag_results = None
            st.session_state.rag_question = None
            st.rerun()

# ============ TAB 4: COMPOSE ============
with tabs[3]:
    st.header("✉️ Send Email")
    
    emails = st.session_state.emails
    selected_email = None
    if emails and st.session_state.selected_index < len(emails):
        selected_email = emails[st.session_state.selected_index]
    
    to_email = st.text_input("To", key="to")
    subject = st.text_input(
        "Subject",
        value="Re: " + selected_email.get("subject", "") if selected_email else "",
        key="subj"
    )
    body = st.text_area(
        "Body",
        value=selected_email.get("body", "") if selected_email else "",
        height=300,
        key="body"
    )

    if st.button("📧 Send", type="primary", key="send"):
        if not to_email.strip():
            st.error("Enter recipient email")
        elif not re.match(r"[^@]+@[^@]+\.[^@]+", to_email):
            st.error("Invalid email address")
        elif not subject.strip():
            st.error("Enter subject")
        elif not body.strip():
            st.error("Enter body")
        else:
            with st.spinner("Sending..."):
                try:
                    resp = requests.post(
                        f"{API_BASE_URL}/email/send",
                        params={"to": to_email, "subject": subject, "body": body},
                        headers=headers,
                        timeout=30
                    )
                    if resp.status_code == 200:
                        st.success(f"✅ Sent to {to_email}!")
                        st.balloons()
                    else:
                        st.error(f"Failed: {resp.text}")
                except Exception as e:
                    st.error(f"Error: {e}")