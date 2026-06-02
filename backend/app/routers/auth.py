from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_user
from app.models import User
from app.schemas import Token, UserOut

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")   # rate limit: 10 attempts per minute per IP
def login(
    request: Request,  # required by slowapi
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    token = create_access_token(user.id, extra={"role": user.role.value})
    return Token(access_token=token)


@router.post("/logout", status_code=204)
def logout(current: User = Depends(get_current_user)):
    pass  # last_seen middleware handles presence; token cleared client-side


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return current
