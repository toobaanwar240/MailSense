# MailSense React Frontend

Converted from Streamlit → React + Vite. Matches the `mailsense_premium.html` design.

## Setup

```bash
cd mailsense
npm install
npm run dev        # starts at http://localhost:3000
```

Keep your FastAPI running on port 8000 as usual.

## File → Streamlit mapping

| React file                        | Replaces (Streamlit)                              |
|-----------------------------------|---------------------------------------------------|
| `src/api/client.js`               | All `requests.get/post()` calls                  |
| `src/utils/cleanEmail.js`         | `clean_for_display()` function                    |
| `src/hooks/useRagStatus.js`       | `fetch_rag_status()` + `st.rerun()` polling       |
| `src/hooks/useEmails.js`          | `st.session_state.emails` + fetch block           |
| `src/hooks/useClassify.js`        | `emails_classified` / `emails_sentiment` caches  |
| `src/components/Sidebar.jsx`      | `st.sidebar.*`                                    |
| `src/components/EmailList.jsx`    | Email `st.selectbox()` + list in Tab 1            |
| `src/components/EmailView.jsx`    | Email detail panel in Tab 1                       |
| `src/components/CategoryBadge.jsx`| `render_badge()` + `render_conf_bar()`           |
| `src/pages/AuthPage.jsx`          | Auth block (if no token → show login)             |
| `src/pages/InboxPage.jsx`         | Tab 1 — 📬 Inbox                                 |
| `src/pages/ChatPage.jsx`          | Tab 2 — 💬 Chat Assistant                        |
| `src/pages/SearchResultsPage.jsx` | Tab 3 — 🔍 Search Results                        |
| `src/pages/ComposePage.jsx`       | Tab 4 — ✉️ Compose                               |
| `src/App.jsx`                     | App shell + session state + routing               |
| `src/styles/tokens.css`           | CSS variables from `mailsense_premium.html`       |

## Auth flow

1. User clicks "Continue with Google" → goes to `http://localhost:8000/auth/login`
2. FastAPI handles OAuth, then redirects to `http://localhost:3000/?token=...&email=...`
3. React reads token from URL, saves to `localStorage`, hides auth page
4. All API calls include `Authorization: Bearer {token}` header

## Session state → React state mapping

| Streamlit `st.session_state.*`   | React equivalent                                  |
|----------------------------------|---------------------------------------------------|
| `token`                          | `localStorage.getItem('ms_token')`               |
| `user_email`                     | `localStorage.getItem('ms_email')`               |
| `emails`                         | `useEmails()` hook → `emails` state              |
| `emails_classified`              | `useClassify()` → in-memory `Map` cache           |
| `emails_sentiment`               | `useClassify()` → in-memory `Map` cache           |
| `selected_index`                 | `selectedEmail` state in `App.jsx`               |
| `chat_history`                   | `history` state in `ChatPage.jsx`                |
| `rag_status`                     | `useRagStatus()` hook                            |
| `rag_indexed_count`              | `useRagStatus().indexedCount`                    |
| `rag_results` / `rag_question`   | `searchResults` / `searchQuestion` in `App.jsx`  |
| `category_filter`                | `categoryFilter` state in `InboxPage.jsx`        |
| `_preview_subj/body`             | `preview` state in `ComposePage.jsx`             |
