"""Middleware to update last_seen on every authenticated request."""
from datetime import datetime, timezone

from fastapi import Request
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_access_token as decode_token
from app.models import User


async def last_seen_middleware(request: Request, call_next):
    response = await call_next(request)

    # Only update on authenticated API calls (not login, health, static)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and request.url.path.startswith("/api/"):
        token = auth.removeprefix("Bearer ").strip()
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                db: Session = SessionLocal()
                try:
                    user = db.get(User, int(user_id))
                    if user and user.is_active:
                        user.last_seen = datetime.now(timezone.utc)
                        db.commit()
                finally:
                    db.close()
        except (JWTError, Exception):
            pass  # never block the response

    return response
