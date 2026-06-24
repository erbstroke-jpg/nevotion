from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import ApiKey, User
from app.services.api_keys import generate_key

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyOut(BaseModel):
    id: int
    name: str
    key_prefix: str
    last_used_at: Optional[datetime] = None
    created_at: datetime
    revoked: bool

    class Config:
        from_attributes = True


class ApiKeyCreated(ApiKeyOut):
    plain_key: str


@router.get("", response_model=list[ApiKeyOut])
def list_keys(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(ApiKey).filter(
        ApiKey.user_id == user.id,
        ApiKey.revoked == False,
    ).order_by(ApiKey.created_at.desc()).all()


@router.post("", response_model=ApiKeyCreated, status_code=201)
def create_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plain, key_hash, prefix = generate_key()
    api_key = ApiKey(
        user_id=user.id,
        name=payload.name,
        key_hash=key_hash,
        key_prefix=prefix,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return ApiKeyCreated(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        last_used_at=api_key.last_used_at,
        created_at=api_key.created_at,
        revoked=api_key.revoked,
        plain_key=plain,
    )


@router.delete("/{key_id}", status_code=204)
def revoke_key(
    key_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not api_key:
        raise HTTPException(404, "Ключ не найден")
    api_key.revoked = True
    db.commit()
