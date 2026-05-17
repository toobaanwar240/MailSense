# MailSense React — Project Structure

```
mailsense/
├── public/
│   └── index.html
├── src/
│   ├── api/
│   │   └── client.js          ← All FastAPI calls (replaces all requests.post/get calls)
│   ├── hooks/
│   │   ├── useEmails.js       ← Fetch + cache emails
│   │   ├── useRagStatus.js    ← Poll RAG index status
│   │   └── useClassify.js     ← Classify + sentiment cache
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── Topbar.jsx
│   │   ├── EmailList.jsx
│   │   ├── EmailView.jsx
│   │   ├── CategoryBadge.jsx
│   │   ├── SentimentBar.jsx
│   │   ├── ChatMessage.jsx
│   │   └── ComposePanel.jsx
│   ├── pages/
│   │   ├── AuthPage.jsx
│   │   ├── InboxPage.jsx
│   │   ├── ChatPage.jsx
│   │   ├── SearchResultsPage.jsx
│   │   └── ComposePage.jsx
│   ├── utils/
│   │   └── cleanEmail.js      ← Port of clean_for_display() from Streamlit
│   ├── App.jsx
│   ├── main.jsx
│   └── styles/
│       └── tokens.css         ← All CSS variables from the HTML design
├── package.json
└── vite.config.js
```
