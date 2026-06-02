from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Server, Task, Board, Role
from app.schemas import UserOut, ServerOut, TaskOut

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

    # Users
    users = db.query(User).filter(
        (User.name.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%")) | (User.position.ilike(f"%{q}%"))
    ).limit(5).all()

    # Servers
    servers = db.query(Server).filter(Server.company.ilike(f"%{q}%")).limit(5).all()

    # Tasks — only visible tasks
    # admin sees all, staff sees own + shared boards
    tq = db.query(Task).join(Board, Task.board_id == Board.id).filter(
        Task.title.ilike(f"%{q}%")
    )
    if user.role != Role.admin:
        tq = tq.filter(
            (Board.kind.in_(["backend_queue", "qcc"])) |
            (Task.owner_id == user.id) |
            (Board.owner_id == user.id)
        )
    tasks = tq.limit(5).all()

    return {
        "users": [{"id": u.id, "name": u.name, "position": u.position, "avatar_color": u.avatar_color, "type": "user"} for u in users],
        "servers": [{"id": s.id, "company": s.company, "status": s.status.value, "type": "server"} for s in servers],
        "tasks": [{"id": t.id, "title": t.title, "board_id": t.board_id, "owner_id": t.owner_id, "type": "task"} for t in tasks],
    }
