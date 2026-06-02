from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Task, Board, User, Role

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def get_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    notifs = []

    # My overdue tasks (not completed)
    overdue = db.query(Task).options(joinedload(Task.board)).filter(
        Task.owner_id == user.id,
        Task.due_date < today,
        Task.completed_at.is_(None),
    ).limit(20).all()

    for t in overdue:
        notifs.append({
            "id": f"overdue_{t.id}",
            "kind": "overdue",
            "title": f"Просрочено: {t.title}",
            "meta": f"Срок был {t.due_date.strftime('%d.%m')}",
            "board_id": t.board_id,
            "task_id": t.id,
            "owner_id": t.owner_id,
        })

    # Tasks assigned to me by someone else (requester != me, owner = me)
    assigned = db.query(Task).options(joinedload(Task.requester)).filter(
        Task.owner_id == user.id,
        Task.requester_id.isnot(None),
        Task.requester_id != user.id,
        Task.completed_at.is_(None),
    ).order_by(Task.id.desc()).limit(20).all()

    for t in assigned:
        who = t.requester.name if t.requester else "Кто-то"
        notifs.append({
            "id": f"assigned_{t.id}",
            "kind": "assigned",
            "title": f"{who} назначил: {t.title}",
            "meta": f"Приоритет: {t.priority.value}",
            "board_id": t.board_id,
            "task_id": t.id,
            "owner_id": t.owner_id,
        })

    # For admins/founders: overdue tasks on shared boards
    if user.role == Role.admin:
        shared_overdue = db.query(Task).join(Board).filter(
            Board.kind.in_(["backend_queue", "qcc"]),
            Task.due_date < today,
            Task.completed_at.is_(None),
        ).limit(10).all()
        for t in shared_overdue:
            notifs.append({
                "id": f"shared_overdue_{t.id}",
                "kind": "overdue",
                "title": f"[Команда] Просрочено: {t.title}",
                "meta": f"Срок был {t.due_date.strftime('%d.%m')}",
                "board_id": t.board_id,
                "task_id": t.id,
                "owner_id": t.owner_id,
            })

    return {"count": len(notifs), "items": notifs}
