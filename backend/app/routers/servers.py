from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import Server, User, ServerStatus
from app.schemas import ServerOut, ServerCreate, ServerUpdate

router = APIRouter(prefix="/api/servers", tags=["servers"])


@router.get("", response_model=list[ServerOut])
def list_servers(
    status: Optional[ServerStatus] = Query(None),
    owner_id: Optional[int] = Query(None),
    limit: int = Query(1000, le=5000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Server).options(joinedload(Server.owner))
    if status:
        q = q.filter(Server.status == status)
    if owner_id:
        q = q.filter(Server.owner_id == owner_id)
    return q.order_by(Server.status, Server.company).offset(offset).limit(limit).all()


@router.post("", response_model=ServerOut, status_code=201)
def create_server(payload: ServerCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import Role
    data = payload.model_dump()
    if data.get("connected_at") is None:
        data["connected_at"] = date.today()
    # Non-admins can only create bots under themselves
    if current_user.role != Role.admin:
        data["owner_id"] = current_user.id
    server = Server(**data)
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


@router.patch("/{server_id}", response_model=ServerOut)
def update_server(server_id: int, payload: ServerUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import Role
    server = db.get(Server, server_id)
    if not server:
        raise HTTPException(404, "Бот не найден")
    if current_user.role != Role.admin and server.owner_id != current_user.id:
        raise HTTPException(403, "Нет доступа: можно редактировать только своего бота")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(server, f, v)
    db.commit()
    db.refresh(server)
    return server


@router.delete("/{server_id}", status_code=204)
def delete_server(server_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    server = db.get(Server, server_id)
    if not server:
        raise HTTPException(404, "Бот не найден")
    db.delete(server)
    db.commit()
