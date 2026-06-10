from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import BugReport, BugStatus, User, Role
from app.schemas import UserOut

router = APIRouter(prefix="/api/bugs", tags=["bugs"])


class BugReportCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"


class BugReportUpdate(BaseModel):
    status: Optional[BugStatus] = None
    priority: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


class BugReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reporter_id: Optional[int]
    title: str
    description: str
    status: BugStatus
    priority: str
    created_at: str
    reporter: Optional[UserOut] = None


def _load(db: Session, bug_id: int) -> BugReport:
    b = db.query(BugReport).options(joinedload(BugReport.reporter)).filter(BugReport.id == bug_id).first()
    if not b:
        raise HTTPException(404, "Баг-репорт не найден")
    return b


@router.get("", response_model=list[BugReportOut])
def list_bugs(
    status: Optional[BugStatus] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(BugReport).options(joinedload(BugReport.reporter))
    if user.role != Role.admin:
        q = q.filter(BugReport.reporter_id == user.id)
    if status:
        q = q.filter(BugReport.status == status)
    return q.order_by(BugReport.created_at.desc()).all()


@router.get("/count/new", response_model=dict)
def count_new_bugs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != Role.admin:
        return {"count": 0}
    count = db.query(BugReport).filter(BugReport.status == BugStatus.new).count()
    return {"count": count}


@router.post("", response_model=BugReportOut, status_code=201)
def create_bug(
    payload: BugReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = BugReport(
        reporter_id=user.id,
        title=payload.title.strip(),
        description=payload.description,
        priority=payload.priority,
        status=BugStatus.new,
    )
    db.add(b)
    db.commit()
    return _load(db, b.id)


@router.patch("/{bug_id}", response_model=BugReportOut)
def update_bug(
    bug_id: int,
    payload: BugReportUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = _load(db, bug_id)
    # Only admin can change status; reporter can edit title/description
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and user.role != Role.admin:
        raise HTTPException(403, "Только администратор может менять статус")
    if user.role != Role.admin and b.reporter_id != user.id:
        raise HTTPException(403, "Нет прав")
    for k, v in data.items():
        setattr(b, k, v)
    db.commit()
    return _load(db, bug_id)


@router.delete("/{bug_id}", status_code=204)
def delete_bug(
    bug_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = db.get(BugReport, bug_id)
    if not b:
        raise HTTPException(404, "Баг-репорт не найден")
    if user.role != Role.admin and b.reporter_id != user.id:
        raise HTTPException(403, "Нет прав")
    db.delete(b)
    db.commit()
