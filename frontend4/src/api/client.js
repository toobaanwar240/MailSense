/**
 * api/client.js
 * Central API layer — every call to your FastAPI backend lives here.
 * Streamlit used: requests.get/post(f"{API_BASE_URL}/...")
 * React uses: fetch('/api/...') which Vite proxies to http://localhost:8000
 *
 * TOKEN: stored in localStorage after Google OAuth redirect.
 * FastAPI redirects to: http://localhost:3000/auth/callback?token=...&email=...
 */

const BASE = '/api';

function getToken() {
  return localStorage.getItem('ms_token');
}

function headers(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function get(path, timeout = 10000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, { headers: headers(), signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

async function post(path, body = {}, timeout = 30000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Streamlit: st.markdown("### [Login](http://localhost:8000/auth/login)")
export const authLoginUrl = () => `http://localhost:8000/auth/login`;

// Streamlit: requests.get(f"{API_BASE_URL}/email/list", headers=headers)
export const getEmails = (params = {}) => {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.append('limit', params.limit);
  if (params.is_read !== undefined) query.append('is_read', params.is_read);
  const queryString = query.toString();
  return get(`/email/list${queryString ? `?${queryString}` : ''}`);
};

export const fetchEmails = getEmails;

// Streamlit: requests.post(f"{API_BASE_URL}/email/send", params={...})
export const sendEmail = ({ to, subject, body }) =>
  fetch(`${BASE}/email/send?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, {
    method: 'POST',
    headers: headers(),
  }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });

// ─── RAG ──────────────────────────────────────────────────────────────────────
// Streamlit: requests.get(f"{API_BASE_URL}/rag/status")
export const fetchRagStatus = () => get('/rag/status', 5000);

// Streamlit: requests.get(f"{API_BASE_URL}/rag/admin/status")
export const fetchRagAdminStatus = () => get('/rag/admin/status', 5000);

// Streamlit: requests.post(f"{API_BASE_URL}/rag/index")
export const triggerIndex = () => post('/rag/index', {}, 10000);

// Streamlit: requests.post(f"{API_BASE_URL}/rag/ask", json={"question": ...})
export const askRag = (question) => post('/rag/ask', { question }, 60000);

// ─── AI ───────────────────────────────────────────────────────────────────────
// Streamlit: requests.post(f"{API_BASE_URL}/ai/classify", json={...})
export const classifyEmail = ({ subject, body }) =>
  post('/ai/classify', { subject, body: body?.slice(0, 500) });

// Streamlit: requests.post(f"{API_BASE_URL}/ai/sentiment", json={...})
export const analyzeSentiment = ({ subject, body }) =>
  post('/ai/sentiment', { subject, body: body?.slice(0, 1000) });

// Streamlit: requests.post(f"{API_BASE_URL}/ai/summarize", json={"email_text": ...})
export const summarizeEmail = (email_text) => post('/ai/summarize', { email_text });

// Streamlit: requests.post(f"{API_BASE_URL}/ai/caption", json={"email_text": ...})
export const captionEmail = (email_text) => post('/ai/caption', { email_text });

// Streamlit: requests.post(f"{API_BASE_URL}/ai/process-email-event", json={"email_text": ...})
export const createCalendarEvent = (email_text) => post('/ai/process-email-event', { email_text });

// Streamlit: requests.post(f"{API_BASE_URL}/ai/reply", json={...})
export const generateReply = ({ sender, subject, email_text, your_name = 'Assistant', tone }) =>
  post('/ai/reply', { sender, subject, email_text, your_name, tone }, 30000);

// Streamlit: requests.post(f"{API_BASE_URL}/ai/generate-email", json={...})
export const generateEmail = ({ to, topic, tone, additional_context }) =>
  post('/ai/generate-email', { to, topic, tone, additional_context }, 30000);
