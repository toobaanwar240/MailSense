import streamlit as st
import requests
import re
from datetime import datetime

API_BASE_URL = "http://localhost:8000"

st.set_page_config(page_title="Gmail AI Assistant", page_icon="📧", layout="wide")

# ========================
# Session State
# ========================
defaults = {
    "token": None,
    "user_email": None,
    "rag_results": None,
    "rag_question": None,
    "emails": [],
    "selected_index": 0,
    "chat_history": [],
    "rag_status": "idle",        # idle | indexing | ready | error
    "rag_indexed_count": 0,
    "rag_last_checked": None,
    "compose_last_index": -1,    # track which email was last loaded into compose
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ========================
# Helpers
# ========================

def get_headers():
    return {"Authorization": f"Bearer {st.session_state.token}"}


def highlight_keywords(text: str, keywords: list) -> str:
    if not text:
        return ""
    for kw in keywords:
        if len(kw) > 2:
            pattern = re.compile(re.escape(kw), re.IGNORECASE)
            text = pattern.sub(f"**🔴{kw.upper()}🔴**", text)
    return text


def clean_for_display(text: str) -> str:
    """Strip HTML tags and invisible Unicode for display in Streamlit."""
    if not text:
        return ""
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    for tag in ['p', 'div', 'br', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
        text = re.sub(rf'</?{tag}[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'[\u034f\u00ad\u200b\u200c\u200d\ufeff\u2060\u180e\u00a0]', ' ', text)
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if not re.match(r'^https?://\S+$', l)]
    lines = [l for l in lines if not (len(l) > 80 and ' ' not in l)]
    text = '\n'.join(lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


def fetch_rag_status():
    """Poll /rag/status and update session state. Returns status string."""
    try:
        r = requests.get(
            f"{API_BASE_URL}/rag/status",
            headers=get_headers(),
            timeout=5
        )
        if r.status_code == 200:
            data = r.json()
            st.session_state.rag_status = data.get("status", "idle")
            st.session_state.rag_indexed_count = data.get("indexed_emails", 0)
            st.session_state.rag_last_checked = datetime.now().strftime("%H:%M:%S")
            return st.session_state.rag_status
    except Exception:
        pass
    return st.session_state.rag_status


def trigger_index():
    """Call /rag/index (non-blocking queue) and refresh status."""
    try:
        r = requests.post(f"{API_BASE_URL}/rag/index", headers=get_headers(), timeout=10)
        if r.status_code == 200:
            st.session_state.rag_status = "indexing"
            return True
    except Exception:
        pass
    return False


# ========================
# Auth
# ========================
st.title("📧 Gmail AI Assistant")

query_params = st.query_params
if "token" in query_params:
    st.session_state.token = str(query_params["token"])
if "email" in query_params:
    st.session_state.user_email = str(query_params["email"])

if not st.session_state.token:
    st.subheader("Welcome! Please login to continue.")
    st.markdown("### [🔐 Login with Google](http://localhost:8000/auth/login)")
    st.info("Click the link above to authenticate with your Google account.")
    st.stop()

headers = get_headers()

# ========================
# Auto-poll while indexing
# ========================
if st.session_state.rag_status == "indexing":
    import time
    time.sleep(0.5)
    fetch_rag_status()
    if st.session_state.rag_status == "indexing":
        st.rerun()

# ========================
# SIDEBAR
# ========================
st.sidebar.header("🔍 Email Index")

fetch_rag_status()
status = st.session_state.rag_status

STATUS_UI = {
    "idle":         ("⚪", "Not indexed",  ""),
    "indexing":     ("🟡", "Indexing…",    "info"),
    "ready":        ("🟢", "Ready",        "success"),
    "error":        ("🔴", "Index error",  "error"),
    "rate_limited": ("🟠", "Rate limited", "warning"),
}
icon, label, alert_type = STATUS_UI.get(status, ("⚪", status, ""))

st.sidebar.markdown(f"**Index Status:** {icon} {label}")

if status == "indexing":
    st.sidebar.progress(0.0, text="Indexing your emails in background…")
elif status == "ready":
    st.sidebar.caption(
        f"✅ {st.session_state.rag_indexed_count} emails indexed  "
        f"· checked {st.session_state.rag_last_checked or ''}"
    )
elif status == "error":
    st.sidebar.warning("Indexing failed. Try re-indexing below.")

try:
    s = requests.get(f"{API_BASE_URL}/rag/admin/status", headers=headers, timeout=5)
    if s.status_code == 200:
        d = s.json()
        db_stats  = d.get("database", {})
        rag_stats = d.get("rag", {})
        c1, c2, c3 = st.sidebar.columns(3)
        c1.metric("Total",   db_stats.get("total_emails", 0))
        c2.metric("Unread",  db_stats.get("unread_emails", 0))
        c3.metric("Indexed", rag_stats.get("indexed_emails", 0))
except Exception:
    pass

st.sidebar.divider()

btn_label    = "⏳ Indexing…" if status == "indexing" else "🔄 Index Emails"
btn_disabled = status == "indexing"

if st.sidebar.button(btn_label, use_container_width=True, disabled=btn_disabled):
    if trigger_index():
        st.sidebar.info("Indexing queued — this runs in the background.")
        st.rerun()
    else:
        st.sidebar.error("Failed to queue indexing. Is the backend running?")

st.sidebar.divider()
if st.session_state.user_email:
    st.sidebar.write(f"👤 {st.session_state.user_email}")
if st.sidebar.button("🚪 Logout", use_container_width=True):
    st.session_state.clear()
    st.rerun()

# ========================
# TABS
# ========================
tabs = st.tabs(["📬 Inbox", "💬 Chat Assistant", "🔍 Search Results", "✉️ Compose"])

# ─────────────────────────────────────────────
# TAB 1 — INBOX
# ─────────────────────────────────────────────
with tabs[0]:
    st.header("Your Inbox")

    if st.button("🔄 Refresh Emails", key="refresh_inbox"):
        st.session_state.emails = []
        st.rerun()

    try:
        resp = requests.get(f"{API_BASE_URL}/email/list", headers=headers, timeout=10)
        if resp.status_code == 200:
            fetched = resp.json().get("emails", [])
            st.caption(f"📊 {len(fetched)} emails loaded")
            if fetched:
                st.session_state.emails = fetched
        else:
            st.error(f"Failed to fetch emails: {resp.status_code}")
    except Exception as e:
        st.error(f"Error fetching emails: {e}")

    emails = st.session_state.emails
    if not emails:
        st.info("No emails loaded. Click 'Refresh Emails'.")
        st.stop()

    st.subheader(f"📧 {len(emails)} Emails")

    email_options = []
    for idx, em in enumerate(emails):
        subj  = em.get('subject', 'No Subject')
        sndr  = em.get('sender', 'Unknown')
        subj_s = (subj[:40] + "…") if len(subj) > 40 else subj
        sndr_s = sndr.split('<')[0].strip() if '<' in sndr else sndr[:20]
        email_options.append(f"{idx+1}. {subj_s} — {sndr_s}")

    selected_index = st.selectbox(
        "Select Email to View",
        options=list(range(len(emails))),
        format_func=lambda x: email_options[x],
        key="email_selector"
    )

    # Always update selected_index and always keep compose shadow vars in sync.
    # We do this unconditionally so even the first email (index 0) is reflected.
    st.session_state.selected_index = selected_index
    sel = emails[selected_index]

    # No compose sync needed here — compose tab derives content directly
    # from the selected email on every render (no widget keys = no stale state).

    st.divider()
    st.subheader("📧 Email Details")

    c1, c2 = st.columns([2, 1])
    with c1:
        st.markdown(f"**Subject:** {sel.get('subject', 'No Subject')}")
        st.markdown(f"**From:** {sel.get('sender', 'Unknown')}")
    with c2:
        st.markdown(f"**Date:** {sel.get('date', 'Unknown')}")
        if sel.get('is_read') is False:
            st.markdown("**Status:** 🔵 Unread")
        else:
            st.markdown("**Status:** ✓ Read")

    st.divider()

    raw_content   = sel.get("body") or sel.get("snippet") or sel.get("text") or ""
    email_content = clean_for_display(raw_content)
    st.caption(f"Content length: {len(email_content)} chars (raw: {len(raw_content)})")

    st.markdown("**📄 Email Content:**")
    with st.expander("View Full Content", expanded=True):
        if email_content:
            st.markdown(email_content)
        else:
            st.warning("⚠️ This email has no content available.")
            if st.checkbox("Show raw email data (debug)", key="debug_raw"):
                st.json(sel)

    st.divider()
    st.markdown("**🛠️ Actions:**")
    col1, col2, col3 = st.columns(3)

    def ai_action(endpoint, payload, key, success_field):
        try:
            r = requests.post(
                f"{API_BASE_URL}/ai/{endpoint}",
                json=payload,
                headers=headers,
                timeout=30
            )
            if r.status_code == 200:
                st.success(f"✅ {success_field.title()}:")
                st.info(r.json().get(success_field, "No response"))
            else:
                st.error(f"Error: {r.text}")
        except Exception as e:
            st.error(f"Error: {e}")

    with col1:
        if st.button("📝 Summarize", use_container_width=True, key="inbox_sum"):
            if not email_content:
                st.error("No content to summarize.")
            else:
                with st.spinner("Summarizing…"):
                    ai_action("summarize", {"email_text": email_content}, "inbox_sum", "summary")

    with col2:
        if st.button("🏷️ Caption", use_container_width=True, key="inbox_cap"):
            if not email_content:
                st.error("No content for caption.")
            else:
                with st.spinner("Generating caption…"):
                    ai_action("caption", {"email_text": email_content}, "inbox_cap", "caption")

    with col3:
        if st.button("📅 Calendar", use_container_width=True, key="inbox_cal"):
            if not email_content:
                st.error("No content to create event from.")
            else:
                with st.spinner("Creating event…"):
                    try:
                        r = requests.post(
                            f"{API_BASE_URL}/ai/process-email-event",
                            json={"email_text": email_content},
                            headers=headers,
                            timeout=30
                        )
                        if r.status_code == 200:
                            st.success("✅ Event created!")
                        else:
                            st.error(f"Error: {r.text}")
                    except Exception as e:
                        st.error(f"Error: {e}")


# ─────────────────────────────────────────────
# TAB 2 — CHAT ASSISTANT
# ─────────────────────────────────────────────
with tabs[1]:
    st.header("💬 Chat with Your Emails")

    current_status = st.session_state.rag_status

    if current_status == "idle":
        st.warning(
            "📭 Your emails haven't been indexed yet.  \n"
            "Click **Index Emails** in the sidebar to get started."
        )
        if st.button("🔄 Start Indexing Now", type="primary"):
            if trigger_index():
                st.info("Indexing started in background. This page will update automatically.")
                st.rerun()
        st.stop()

    if current_status == "indexing":
        st.info(
            "⏳ **Indexing your emails…** This runs in the background.  \n"
            "The page will refresh automatically when done."
        )
        with st.spinner("Indexing in progress…"):
            import time; time.sleep(2)
        fetch_rag_status()
        st.rerun()

    if current_status == "error":
        st.error(
            "❌ Email indexing encountered an error.  \n"
            "Try clicking **Index Emails** in the sidebar again."
        )
        st.warning("You can still ask questions but results may be incomplete.")

    st.markdown("""
    Ask me anything about your emails! I can:
    - Find emails from a specific person
    - Summarize conversations  
    - Identify urgent items & deadlines
    - Search by topic or keyword
    """)

    user_question = st.text_input(
        "Ask me about your emails",
        placeholder="e.g., What are my upcoming deadlines?",
        key="chat_input"
    )

    c1, c2 = st.columns([1, 5])
    with c1:
        ask_button = st.button("💬 Ask", type="primary", use_container_width=True)
    with c2:
        if st.session_state.chat_history:
            if st.button("🗑️ Clear History", use_container_width=True):
                st.session_state.chat_history = []
                st.rerun()

    if ask_button and user_question.strip():
        with st.spinner("Thinking…"):
            try:
                resp = requests.post(
                    f"{API_BASE_URL}/rag/ask",
                    json={"question": user_question},
                    headers=headers,
                    timeout=60
                )
                if resp.status_code == 200:
                    result = resp.json()
                    if result.get("status") in ("indexing", "idle"):
                        st.info(result.get("answer", "Still indexing, please wait."))
                        fetch_rag_status()
                    else:
                        st.session_state.chat_history.append({
                            "question": user_question,
                            "answer": result.get("answer", "No answer"),
                            "sources": result.get("sources", [])
                        })
                        st.rerun()
                else:
                    st.error(f"Error: {resp.text}")
            except Exception as e:
                st.error(f"Error: {e}")

    st.divider()

    if not st.session_state.chat_history:
        st.info("👋 Ask me a question to get started!")
    else:
        st.subheader(f"Conversation ({len(st.session_state.chat_history)} messages)")
        for i, chat in enumerate(reversed(st.session_state.chat_history)):
            idx = len(st.session_state.chat_history) - i
            with st.container():
                st.markdown(f"**🙋 You ({idx}):**")
                st.write(chat["question"])
                st.markdown("**🤖 Assistant:**")
                st.info(chat["answer"])
                sources = chat.get("sources", [])
                if sources:
                    st.caption(f"📚 Based on {len(sources)} emails")
                    if st.button(f"View {len(sources)} source emails", key=f"sources_{idx}"):
                        st.session_state.rag_results = {
                            "answer": chat["answer"],
                            "sources": sources
                        }
                        st.session_state.rag_question = chat["question"]
                        st.success("👉 Switch to the 'Search Results' tab to view sources")
                if i < len(st.session_state.chat_history) - 1:
                    st.markdown("---")


# ─────────────────────────────────────────────
# TAB 3 — SEARCH RESULTS
# ─────────────────────────────────────────────
with tabs[2]:
    st.header("🔍 Detailed Search Results")

    if not st.session_state.rag_results:
        st.info("No search results yet. Use the Chat Assistant tab to ask questions!")
    else:
        result   = st.session_state.rag_results
        question = st.session_state.rag_question or "Previous search"
        keywords = [w for w in question.lower().split() if len(w) > 2]
        sources  = result.get("sources", [])

        st.markdown(f"### Question: *{question}*")
        st.info(result.get("answer", "No answer"))

        if sources:
            st.success(f"✅ {len(sources)} matching emails")
        else:
            st.warning("No emails found.")

        sources_sorted = sorted(sources, key=lambda x: x.get("relevance", 0), reverse=True)

        for i, src in enumerate(sources_sorted, 1):
            if not src.get("email_id"):
                continue

            relevance = src.get("relevance", 0)
            with st.container():
                st.markdown(f"#### #{i} — {src.get('subject', 'No Subject')} ({relevance}% match)")

                c1, c2 = st.columns(2)
                c1.write(f"**From:** {src.get('sender', 'Unknown')}")
                c2.write(f"**Date:** {src.get('date', 'Unknown')}")

                if src.get("is_urgent"):
                    st.error("🔴 URGENT")
                if src.get("has_deadline") and src.get("deadline") != "None":
                    st.warning(f"⏰ Deadline: {src.get('deadline')}")

                show_key = f"show_{i}"
                if show_key not in st.session_state:
                    st.session_state[show_key] = (i <= 3)

                if st.button(
                    "▲ Hide Content" if st.session_state[show_key] else "▼ Show Content",
                    key=f"toggle_{i}"
                ):
                    st.session_state[show_key] = not st.session_state[show_key]
                    st.rerun()

                if st.session_state[show_key]:
                    raw   = src.get("text", "")
                    clean = clean_for_display(raw)
                    highlighted = highlight_keywords(clean, keywords)
                    st.markdown("**📄 Content:**")
                    st.markdown(highlighted)
                    st.divider()

                    st.markdown("**🛠️ Tools:**")
                    t1, t2, t3 = st.columns(3)
                    with t1:
                        if st.button("📝 Summarize", key=f"sum_{i}", use_container_width=True):
                            with st.spinner("…"):
                                try:
                                    r = requests.post(f"{API_BASE_URL}/ai/summarize",
                                                      json={"email_text": clean},
                                                      headers=headers, timeout=30)
                                    if r.status_code == 200:
                                        st.success("✅ Summary:")
                                        st.info(r.json().get("summary"))
                                    else:
                                        st.error(r.text)
                                except Exception as e:
                                    st.error(e)
                    with t2:
                        if st.button("🏷️ Caption", key=f"cap_{i}", use_container_width=True):
                            with st.spinner("…"):
                                try:
                                    r = requests.post(f"{API_BASE_URL}/ai/caption",
                                                      json={"email_text": clean},
                                                      headers=headers, timeout=30)
                                    if r.status_code == 200:
                                        st.success("✅ Caption:")
                                        st.info(r.json().get("caption"))
                                    else:
                                        st.error(r.text)
                                except Exception as e:
                                    st.error(e)
                    with t3:
                        if st.button("📅 Event", key=f"evt_{i}", use_container_width=True):
                            with st.spinner("…"):
                                try:
                                    r = requests.post(f"{API_BASE_URL}/ai/process-email-event",
                                                      json={"email_text": clean},
                                                      headers=headers, timeout=30)
                                    if r.status_code == 200:
                                        st.success("✅ Event created!")
                                    else:
                                        st.error(r.text)
                                except Exception as e:
                                    st.error(e)

                st.markdown("---")

        if st.button("🗑️ Clear Results", key="clear"):
            st.session_state.rag_results = None
            st.session_state.rag_question = None
            st.rerun()


# ─────────────────────────────────────────────
# TAB 4 — COMPOSE
# ─────────────────────────────────────────────
with tabs[3]:
    st.header("✉️ Send Email")

    emails = st.session_state.emails
    sel_em = emails[st.session_state.selected_index] if emails else None

    # ── Mode toggle ───────────────────────────────────────────────────────────
    mode = st.radio(
        "Mode",
        ["✏️ New Email", "↩️ Reply to Selected"],
        horizontal=True,
        key="compose_mode"
    )
    st.divider()
    is_reply = (mode == "↩️ Reply to Selected")

    # ── Base field values from selected email or blank ────────────────────────
    if is_reply and sel_em:
        base_to   = sel_em.get("from", "") or sel_em.get("sender", "")
        base_subj = "Re: " + sel_em.get("subject", "")
        base_body = clean_for_display(
            sel_em.get("body", "") or sel_em.get("snippet", "") or sel_em.get("text", "")
        )
    else:
        base_to   = ""
        base_subj = ""
        base_body = ""

    # ── If AI content was accepted, override base values ─────────────────────
    if st.session_state.get("ai_reply_applied"):
        base_subj = st.session_state.pop("ai_reply_applied_subj", base_subj)
        base_body = st.session_state.pop("ai_reply_applied_body", base_body)
        st.session_state.pop("ai_reply_applied", None)

    # ── Compose fields (no key= so value= always works) ──────────────────────
    to_email = st.text_input("To", value=base_to)
    subject  = st.text_input("Subject", value=base_subj)
    body     = st.text_area("Body", value=base_body, height=250)

    st.divider()

    # ── Tone selector (used by both modes) ────────────────────────────────────
    tone = st.selectbox("Tone", ["professional", "formal", "casual"], key="reply_tone")

    # ── Mode-specific AI button ───────────────────────────────────────────────
    if is_reply:
        # REPLY: generate a reply to the selected inbox email
        if st.button("🤖 Generate AI Reply", key="ai_reply", use_container_width=True):
            if not sel_em:
                st.warning("Select an email in the Inbox tab first.")
            else:
                with st.spinner("Generating reply…"):
                    try:
                        r = requests.post(
                            f"{API_BASE_URL}/ai/reply",
                            json={
                                "sender":     sel_em.get("from", "") or sel_em.get("sender", ""),
                                "subject":    sel_em.get("subject", ""),
                                "email_text": clean_for_display(sel_em.get("body", "")),
                                "your_name":  "Assistant",
                                "tone":       tone,
                            },
                            headers=headers,
                            timeout=30,
                        )
                        if r.status_code == 200:
                            d = r.json()
                            st.session_state["_preview_subj"]   = d.get("reply_subject", "")
                            st.session_state["_preview_body"]   = d.get("reply_body", "")
                            st.session_state["_preview_intent"] = d.get("detected_intent", "")
                        else:
                            st.error(f"Failed: {r.text}")
                    except Exception as e:
                        st.error(f"Error: {e}")

        if st.session_state.get("_preview_intent"):
            st.caption(f"🏷️ Detected intent: **{st.session_state['_preview_intent']}**")

    else:
        # NEW EMAIL: generate from a topic description
        st.markdown("**✨ Generate Email with AI**")
        topic = st.text_area(
            "What should the email be about?",
            placeholder="e.g. Ask the client for a 2-week extension due to resource constraints",
            height=80,
            key="gen_topic",
        )
        gen_context = st.text_input(
            "Extra details (optional)",
            placeholder="e.g. Keep it under 150 words, mention Friday deadline",
            key="gen_context",
        )
        if st.button("✨ Generate Email", key="gen_email", use_container_width=True):
            if not topic.strip():
                st.warning("Describe what the email should be about.")
            else:
                with st.spinner("Writing your email…"):
                    try:
                        r = requests.post(
                            f"{API_BASE_URL}/ai/generate-email",
                            json={
                                "to":                 to_email,
                                "topic":              topic,
                                "tone":               tone,
                                "additional_context": gen_context,
                            },
                            headers=headers,
                            timeout=30,
                        )
                        if r.status_code == 200:
                            d = r.json()
                            st.session_state["_preview_subj"]   = d.get("subject", "")
                            st.session_state["_preview_body"]   = d.get("body", "")
                            st.session_state["_preview_intent"] = ""
                        else:
                            st.error(f"Failed: {r.text}")
                    except Exception as e:
                        st.error(f"Error: {e}")

    # ── Preview panel — shown whenever AI has generated something ─────────────
    if st.session_state.get("_preview_body"):
        st.markdown("---")
        st.markdown("#### 📋 Preview")
        st.markdown(f"**Subject:** {st.session_state.get('_preview_subj', '')}")
        st.text_area(
            "Generated body",
            value=st.session_state["_preview_body"],
            height=200,
            disabled=True,
            key="_preview_display",
            label_visibility="collapsed",
        )
        col1, col2 = st.columns(2)
        with col1:
            if st.button("✅ Use this", key="use_reply", type="primary", use_container_width=True):
                st.session_state["ai_reply_applied"]      = True
                st.session_state["ai_reply_applied_subj"] = st.session_state.pop("_preview_subj", "")
                st.session_state["ai_reply_applied_body"] = st.session_state.pop("_preview_body", "")
                st.session_state.pop("_preview_intent", None)
                st.rerun()
        with col2:
            if st.button("❌ Discard", key="discard_reply", use_container_width=True):
                st.session_state.pop("_preview_subj", None)
                st.session_state.pop("_preview_body", None)
                st.session_state.pop("_preview_intent", None)
                st.rerun()

    st.divider()

    # ── Send ──────────────────────────────────────────────────────────────────
    if st.button("📧 Send", type="primary", key="send", use_container_width=True):
        if not to_email.strip():
            st.error("Enter a recipient email address.")
        elif not re.match(r"[^@]+@[^@]+\.[^@]+", to_email):
            st.error("Invalid email address.")
        elif not subject.strip():
            st.error("Enter a subject.")
        elif not body.strip():
            st.error("Enter a message body.")
        else:
            with st.spinner("Sending…"):
                try:
                    resp = requests.post(
                        f"{API_BASE_URL}/email/send",
                        params={"to": to_email, "subject": subject, "body": body},
                        headers=headers,
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        st.success(f"✅ Sent to {to_email}!")
                        st.balloons()
                    else:
                        st.error(f"Failed: {resp.text}")
                except Exception as e:
                    st.error(f"Error: {e}")