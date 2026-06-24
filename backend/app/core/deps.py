from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token as decode_token
from app.models import User, Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Недействительный токен",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # --- API key auth ---
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        from app.services.api_keys import verify_key
        user = verify_key(db, api_key_header)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный API-ключ",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт деактивирован. Обратитесь к администратору.",
            )
        return user

    # --- JWT auth ---
    if not token:
        raise credentials_exc
    try:
        payload = decode_token(token)
        if payload is None:
            raise credentials_exc
        user_id: int = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except (JWTError, AttributeError):
        raise credentials_exc

    user = db.get(User, user_id)
    if not user:
        raise credentials_exc

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован. Обратитесь к администратору.",
        )
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора",
        )
    return user


def require_founder(user: User = Depends(get_current_user)) -> User:
    if not user.is_founder:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ только для основателей",
        )
    return user
