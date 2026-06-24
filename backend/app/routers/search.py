from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Project, Task, Board, Role
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
        return {"users": [], "projects": [], "tasks": []}

    # Users — admins/founders see all, staff sees only active colleagues (no email exposed)
    user_q = db.query(User).filter(
        User.is_active == True,
        (User.name.ilike(f"%{q}%")) | (User.position.ilike(f"%{q}%"))
    )
    users = user_q.limit(5).all()

    # Projects — only founder/admin see all; staff sees only their own projects
    project_q = db.query(Project).filter(Project.company.ilike(f"%{q}%"))
    if not (user.role == Role.admin or user.is_founder):
        project_q = project_q.filter(Project.owner_id == user.id)
    projects = project_q.limit(5).all()

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
        "projects": [{"id": p.id, "company": p.company, "status": p.status.value, "type": "project"} for p in projects],
        "tasks": [{"id": t.id, "title": t.title, "board_id": t.board_id, "owner_id": t.owner_id, "type": "task"} for t in visible_tasks],
    }
