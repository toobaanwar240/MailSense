import urllib
from dotenv import load_dotenv
from fastapi.responses import RedirectResponse
import httpx  # ✅ Changed from requests to httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db.models import create_or_update_user
import os

from backend.router.dependencies import create_jwt

load_dotenv()
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

router = APIRouter(tags=["Auth"])
redirect_uri = "http://localhost:8000/auth/callback"
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]
TOKEN_URL = "https://oauth2.googleapis.com/token"
TOKEN_INFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo"


@router.get("/login")
async def google_login():  # ✅ Changed from def to async def
    """Initiate Google OAuth login - ASYNC version."""
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent"
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(url)


@router.get("/callback")
async def auth_callback(code: str, db: Session = Depends(get_db)):  # ✅ Changed from def to async def
    """Handle Google OAuth callback - ASYNC version."""
    
    # ✅ Use async HTTP client instead of requests
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Prepare token exchange data
        data = {
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        
        # ✅ Changed from requests.post to await client.post
        token_response = await client.post(TOKEN_URL, data=data)

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail=token_response.json())

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        id_token = token_data.get("id_token")

        if not id_token:
            raise HTTPException(status_code=400, detail="Missing ID token")

        # ✅ Changed from requests.get to await client.get
        userinfo_response = await client.get(TOKEN_INFO_URL, params={"id_token": id_token})
        userinfo = userinfo_response.json()
        
        if "error_description" in userinfo:
            raise HTTPException(status_code=400, detail=userinfo)

        google_user_id = userinfo["sub"]
        email = userinfo["email"]

        # Database operation (synchronous, but that's OK)
        user = create_or_update_user(
            db=db,
            google_user_id=google_user_id,
            email=email,
            access_token=access_token,
            refresh_token=refresh_token,
        )
        
        # Generate JWT token
        token = create_jwt(user.id)
        
        # Redirect to frontend with token
        return RedirectResponse(
            url=f"http://localhost:8501/?token={token}&email={email}"
        )