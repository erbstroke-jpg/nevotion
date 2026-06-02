from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import MarketingRecord, ColumnDef, Department, User
from app.schemas import (
    MarketingRecordOut, MarketingRecordCreate, MarketingRecordUpdate,
    ColumnDefOut, ColumnDefCreate,
)
from app.routers.sales import _slugify_key

router = APIRouter(prefix="/api/marketing", tags=["marketing"])


@router.get("/columns", response_model=list[ColumnDefOut])
def list_columns(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.kind == "marketing").first()
    if not dept:
        return []
    return db.query(ColumnDef).filter(ColumnDef.department_id == dept.id).order_by(ColumnDef.position).all()


@router.post("/columns", response_model=ColumnDefOut, status_code=201)
def add_column(payload: ColumnDefCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    dept = db.query(Department).filter(Department.kind == "marketing").first()
    if not dept:
        raise HTTPException(404, "Отдел маркетинга не найден")
    maxpos = db.query(ColumnDef).filter(ColumnDef.department_id == dept.id).count()
    col = ColumnDef(department_id=dept.id, key=_slugify_key(payload.label),
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


@router.get("/records", response_model=list[MarketingRecordOut])
def list_records(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(30, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MarketingRecord).options(joinedload(MarketingRecord.user))
    if date_from:
        q = q.filter(MarketingRecord.record_date >= date_from)
    if date_to:
        q = q.filter(MarketingRecord.record_date <= date_to)
    return q.order_by(MarketingRecord.record_date.desc(), MarketingRecord.id.desc()).offset(offset).limit(limit).all()


@router.post("/records", response_model=MarketingRecordOut, status_code=201)
def create_record(payload: MarketingRecordCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    uid = payload.user_id if user.role.value == "admin" else user.id
    rec = MarketingRecord(user_id=uid, record_date=payload.record_date, fields=payload.fields)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.patch("/records/{rec_id}", response_model=MarketingRecordOut)
def update_record(rec_id: int, payload: MarketingRecordUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.get(MarketingRecord, rec_id)
    if not rec:
        raise HTTPException(404, "Запись не найдена")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(rec, f, v)
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/records/{rec_id}", status_code=204)
def delete_record(rec_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rec = db.get(MarketingRecord, rec_id)
    if rec:
        db.delete(rec)
        db.commit()
