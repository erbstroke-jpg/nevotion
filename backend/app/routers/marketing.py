from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import MarketingRecord, ColumnDef, Department, User, AdExpense
from app.schemas import (
    MarketingRecordOut, MarketingRecordCreate, MarketingRecordUpdate,
    ColumnDefOut, ColumnDefCreate,
    AdExpenseOut, AdExpenseCreate, AdExpenseUpdate,
)
from app.routers.sales import _slugify_key
from app.services.marketing import source_metrics, marketing_totals

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


# ─── Ad Expenses ────────────────────────────────────────────────

def _can_manage_ads(user: User) -> bool:
    return user.role == "admin" or user.is_founder or "маркетинг" in (user.position or "").lower()


def _ae_dict(e: AdExpense) -> dict:
    return {
        "id": e.id,
        "date": e.date.isoformat() if e.date else None,
        "source_id": e.source_id,
        "ad_account": e.ad_account,
        "campaign_name": e.campaign_name,
        "amount": e.amount,
        "currency": e.currency,
        "responsible_id": e.responsible_id,
        "comment": e.comment,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "source": {"id": e.source.id, "name": e.source.name} if e.source else None,
        "responsible": {"id": e.responsible.id, "name": e.responsible.name} if e.responsible else None,
    }


@router.get("/ad-expenses")
def list_ad_expenses(
    source_id: Optional[int] = None,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    campaign: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(AdExpense).options(
        joinedload(AdExpense.source),
        joinedload(AdExpense.responsible),
    )
    if source_id:
        q = q.filter(AdExpense.source_id == source_id)
    if date_from:
        q = q.filter(AdExpense.date >= date_from)
    if date_to:
        q = q.filter(AdExpense.date <= date_to)
    if campaign:
        q = q.filter(AdExpense.campaign_name.ilike(f"%{campaign}%"))
    total = q.count()
    items = q.order_by(AdExpense.date.desc(), AdExpense.id.desc()).offset(skip).limit(limit).all()
    return {"items": [_ae_dict(e) for e in items], "total": total}


@router.post("/ad-expenses", status_code=201)
def create_ad_expense(
    body: AdExpenseCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _can_manage_ads(me):
        raise HTTPException(403, "Нет доступа")
    e = AdExpense(**body.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    # re-load with relationships
    e = db.query(AdExpense).options(
        joinedload(AdExpense.source), joinedload(AdExpense.responsible)
    ).filter(AdExpense.id == e.id).first()
    return _ae_dict(e)


@router.patch("/ad-expenses/{exp_id}")
def update_ad_expense(
    exp_id: int,
    body: AdExpenseUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _can_manage_ads(me):
        raise HTTPException(403, "Нет доступа")
    e = db.get(AdExpense, exp_id)
    if not e:
        raise HTTPException(404, "Не найдено")
    for f, v in body.model_dump(exclude_unset=True).items():
        setattr(e, f, v)
    db.commit()
    db.refresh(e)
    e = db.query(AdExpense).options(
        joinedload(AdExpense.source), joinedload(AdExpense.responsible)
    ).filter(AdExpense.id == e.id).first()
    return _ae_dict(e)


@router.delete("/ad-expenses/{exp_id}", status_code=204)
def delete_ad_expense(
    exp_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _can_manage_ads(me):
        raise HTTPException(403, "Нет доступа")
    e = db.get(AdExpense, exp_id)
    if not e:
        raise HTTPException(404)
    db.delete(e)
    db.commit()


# ─── Marketing Metrics ──────────────────────────────────────────

@router.get("/metrics")
def get_metrics(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    by_source = source_metrics(db, date_from, date_to)
    totals = marketing_totals(db, date_from, date_to)
    return {"by_source": by_source, "totals": totals}
