from fastapi import Header, HTTPException
from firebase_admin import auth
from .firebase import firebase_app

async def require_firebase_user(authorization: str | None = Header(default=None)):
    if not firebase_app:
        raise HTTPException(status_code=503, detail="Firebase Admin is not configured.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase ID token.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token.")
