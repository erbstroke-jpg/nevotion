from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Server, Task, Board, Role
from app.routers.boards import _can_view_board

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def search(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = q.strip().lower()
    if not q:
        return {"users": [], "servers": [], "tasks": []}

    # Users — admins/founders see all, staff sees only active colleagues (no email exposed)
    user_q = db.query(User).filter(
        User.is_active == True,
        (User.name.ilike(f"%{q}%")) | (User.position.ilike(f"%{q}%"))
    )
    if not (user.role == Role.admin or user.is_founder):
        # staff can search by name/position only, email not exposed in results
        pass
    users = user_q.limit(5).all()

    # Servers — only founder/admin see all; staff sees only their own bots
    server_q = db.query(Server).filter(Server.company.ilike(f"%{q}%"))
    if not (user.role == Role.admin or user.is_founder):
        server_q = server_q.filter(Server.owner_id == user.id)
    servers = server_q.limit(5).all()

    # Tasks — filter by board visibility using the single source of truth
    all_task_q = db.query(Task).join(Board, Task.board_id == Board.id).filter(
        Task.title.ilike(f"%{q}%")
    ).all()

    visible_tasks = [
        t for t in all_task_q
        if _can_view_board(user, t.board, db)
        and (
            user.role == Role.admin
            or user.is_founder
            or t.board.kind in ("backend_queue", "qcc")
            or t.owner_id == user.id
            or t.board.owner_id == user.id
        )
    ][:5]

    return {
        "users": [{"id": u.id, "name": u.name, "position": u.position, "avatar_color": u.avatar_color, "type": "user"} for u in users],
        "servers": [{"id": s.id, "company": s.company, "status": s.status.value, "type": "server"} for s in servers],
        "tasks": [{"id": t.id, "title": t.title, "board_id": t.board_id, "owner_id": t.owner_id, "type": "task"} for t in visible_tasks],
    }
