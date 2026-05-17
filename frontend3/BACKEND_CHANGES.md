# FastAPI Changes Needed for React Frontend

## 1. Add CORS middleware (main.py / app.py)

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 2. Update Google OAuth redirect URL

In your `/auth/login` route (or Google OAuth config), change the redirect URI from:
```
http://localhost:8000/auth/callback  →  sends to Streamlit at ?token=...
```
to redirect the browser to:
```
http://localhost:3000/?token={token}&email={email}
```

Example FastAPI route change:
```python
# Before (Streamlit):
return RedirectResponse(url=f"http://localhost:8501/?token={token}&email={email}")

# After (React):
return RedirectResponse(url=f"http://localhost:3000/?token={token}&email={email}")
```

## 3. No other backend changes needed

All API endpoints stay exactly the same. The React frontend calls:
- GET  /email/list
- POST /email/send?to=...&subject=...&body=...
- GET  /rag/status
- GET  /rag/admin/status
- POST /rag/index
- POST /rag/ask
- POST /ai/classify
- POST /ai/sentiment
- POST /ai/summarize
- POST /ai/caption
- POST /ai/process-email-event
- POST /ai/reply
- POST /ai/generate-email

The Vite proxy (vite.config.js) routes all /api/* → http://localhost:8000,
so no CORS issues during development. In production, set up your own reverse proxy
(nginx, etc.) or configure CORS for your production domain.
