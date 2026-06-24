from datetime import date, datetime, timezone, timedelta
from typing import Optional

_BISHKEK = timezone(timedelta(hours=6))

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import Project, User, ProjectStatus
from app.schemas import ProjectOut, ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(
    status: Optional[ProjectStatus] = Query(None),
    owner_id: Optional[int] = Query(None),
    limit: int = Query(1000, le=5000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Project).options(joinedload(Project.owner))
    if status:
        q = q.filter(Project.status == status)
    if owner_id:
        q = q.filter(Project.owner_id == owner_id)
    return q.order_by(Project.status, Project.company).offset(offset).limit(limit).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import Role
    data = payload.model_dump()
    if data.get("connected_at") is None:
        data["connected_at"] = date.today()
    if current_user.role != Role.admin:
        data["owner_id"] = current_user.id
    project = Project(**data)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import Role
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Проект не найден")
    if current_user.role != Role.admin and project.owner_id != current_user.id:
        raise HTTPException(403, "Нет доступа: можно редактировать только свой проект")
    data = payload.model_dump(exclude_unset=True)
    if data.get("sub_status") == "Сдан" and not project.delivered_at:
        data["delivered_at"] = datetime.now(_BISHKEK).date()
    for f, v in data.items():
        setattr(project, f, v)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Проект не найден")
    db.delete(project)
    db.commit()
