from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import SalesRecord, ColumnDef, Department, User
from app.schemas import (
    SalesRecordOut, SalesRecordCreate, SalesRecordUpdate,
    ColumnDefOut, ColumnDefCreate,
)

router = APIRouter(prefix="/api/sales", tags=["sales"])


def _slugify_key(label: str) -> str:
    import re
    base = re.sub(r"\s+", "_", label.strip().lower())
    return re.sub(r"[^a-zа-я0-9_]", "", base) or "col"


# ---------- Columns ----------
@router.get("/columns", response_model=list[ColumnDefOut])
def list_columns(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.kind == "sales").first()
    if not dept:
        return []
    return db.query(ColumnDef).filter(ColumnDef.department_id == dept.id).order_by(ColumnDef.position).all()


@router.post("/columns", response_model=ColumnDefOut, status_code=201)
def add_column(payload: ColumnDefCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    dept = db.query(Department).filter(Department.kind == "sales").first()
    if not dept:
        raise HTTPException(404, "Отдел продаж не найден")
    maxpos = db.query(ColumnDef).filter(ColumnDef.department_id == dept.id).count()
    # Ensure unique key within department by appending a counter suffix if needed
    base_key = _slugify_key(payload.label)
    key = base_key
    suffix = 1
    while db.query(ColumnDef).filter(ColumnDef.department_id == dept.id, ColumnDef.key == key).first():
        key = f"{base_key}_{suffix}"
        suffix += 1
    col = ColumnDef(department_id=dept.id, key=key,
                    label=payload.label, kind=payload.kind, position=maxpos)
    db.add(col)
    db.commit()
    db.refresh(col)
    return col


@router.delete("/columns/{col_id}", status_code=204)
def delete_column(col_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    col = db.get(ColumnDef, col_id)
    if col:
        db.delete(col)
        db.commit()


# ---------- Records ----------
@router.get("/records", response_model=list[SalesRecordOut])
def list_records(
    user_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(30, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SalesRecord).options(joinedload(SalesRecord.user))
    if user_id:
        q = q.filter(SalesRecord.user_id == user_id)
    if date_from:
        q = q.filter(SalesRecord.record_date >= date_from)
    if date_to:
        q = q.filter(SalesRecord.record_date <= date_to)
    return q.order_by(SalesRecord.record_date.desc(), SalesRecord.id.desc()).offset(offset).limit(limit).all()


@router.post("/records", response_model=SalesRecordOut, status_code=201)
def create_record(payload: SalesRecordCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # staff records go under themselves
    uid = payload.user_id if user.role.value == "admin" else user.id
    rec = SalesRecord(user_id=uid, record_date=payload.record_date, metrics=payload.metrics)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.patch("/records/{rec_id}", response_model=SalesRecordOut)
def update_record(rec_id: int, payload: SalesRecordUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.get(SalesRecord, rec_id)
    if not rec:
        raise HTTPException(404, "Запись не найдена")
    if user.role.value != "admin" and rec.user_id != user.id:
        raise HTTPException(403, "Можно редактировать только свои записи")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(rec, f, v)
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/records/{rec_id}", status_code=204)
def delete_record(rec_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.get(SalesRecord, rec_id)
    if not rec:
        return
    if user.role.value != "admin" and rec.user_id != user.id:
        raise HTTPException(403, "Нет прав")
    db.delete(rec)
    db.commit()


@router.patch("/columns/{col_id}/position", response_model=ColumnDefOut)
def reorder_column(col_id: int, direction: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Move a sales column left or right. direction: 'left' | 'right'"""
    col = db.get(ColumnDef, col_id)
    if not col:
        raise HTTPException(404, "Колонка не найдена")

    dept = db.get(Department, col.department_id)
    all_cols = db.query(ColumnDef).filter(
        ColumnDef.department_id == col.department_id
    ).order_by(ColumnDef.position).all()

    idx = next((i for i, c in enumerate(all_cols) if c.id == col_id), None)
    if idx is None:
        raise HTTPException(404)

    swap_idx = idx - 1 if direction == "left" else idx + 1
    if swap_idx < 0 or swap_idx >= len(all_cols):
        return col  # already at edge, no-op

    # Swap positions
    all_cols[idx].position, all_cols[swap_idx].position = all_cols[swap_idx].position, all_cols[idx].position
    db.commit()
    db.refresh(col)
    return col
