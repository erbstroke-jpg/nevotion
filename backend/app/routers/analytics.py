"""Analytics router — CEO dashboard, KPI plans, Excel exports."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import get_db, get_current_user
from app.models import MonthlyPlan, User
from app.services.analytics import dashboard_metrics, charts_data, problems, kpi_plan_fact
from app.services.export import export_leads_xlsx, export_finance_xlsx, export_payroll_xlsx

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    try:
        return date.fromisoformat(val[:10])
    except Exception:
        return None


def _is_ceo(user: User) -> bool:
    return user.role == "admin" or user.is_founder


def _plan_dict(p: MonthlyPlan) -> dict:
    return {
        "id": p.id,
        "year": p.year,
        "month": p.month,
        "plan_revenue": p.plan_revenue,
        "plan_leads": p.plan_leads,
        "plan_meetings": p.plan_meetings,
        "plan_sales": p.plan_sales,
        "plan_cpl": p.plan_cpl,
        "plan_cac": p.plan_cac,
        "plan_expenses": p.plan_expenses,
    }


# ── Dashboard ──────────────────────────────────────────────────────

@router.get("/dashboard")
def get_dashboard(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    d_from = _parse_date(date_from)
    d_to = _parse_date(date_to)
    return {
        "metrics": dashboard_metrics(db, d_from, d_to),
        "charts": charts_data(db, d_from, d_to),
        "problems": problems(db),
    }


# ── KPI Plan vs Fact ───────────────────────────────────────────────

@router.get("/kpi")
def get_kpi(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    return kpi_plan_fact(db, year, month)


# ── Monthly Plans CRUD ─────────────────────────────────────────────

class PlanIn(BaseModel):
    year: int
    month: int
    plan_revenue: int = 0
    plan_leads: int = 0
    plan_meetings: int = 0
    plan_sales: int = 0
    plan_cpl: int = 0
    plan_cac: int = 0
    plan_expenses: int = 0


@router.get("/plans")
def list_plans(
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    plans = db.query(MonthlyPlan).order_by(MonthlyPlan.year.desc(), MonthlyPlan.month.desc()).all()
    return [_plan_dict(p) for p in plans]


@router.post("/plans")
def create_plan(
    body: PlanIn,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    existing = db.query(MonthlyPlan).filter_by(year=body.year, month=body.month).first()
    if existing:
        raise HTTPException(409, "План на этот месяц уже существует")
    p = MonthlyPlan(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _plan_dict(p)


@router.put("/plans/{plan_id}")
def update_plan(
    plan_id: int,
    body: PlanIn,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    p = db.query(MonthlyPlan).filter(MonthlyPlan.id == plan_id).first()
    if not p:
        raise HTTPException(404, "Не найдено")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _plan_dict(p)


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    p = db.query(MonthlyPlan).filter(MonthlyPlan.id == plan_id).first()
    if not p:
        raise HTTPException(404)
    db.delete(p)
    db.commit()


# ── Excel Exports ──────────────────────────────────────────────────

@router.get("/export/leads.xlsx")
def export_leads(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    source_id: Optional[int] = None,
    stage_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    data = export_leads_xlsx(db, _parse_date(date_from), _parse_date(date_to), source_id, stage_id)
    from io import BytesIO
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=leads.xlsx"},
    )


@router.get("/export/finance.xlsx")
def export_finance(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    data = export_finance_xlsx(db, _parse_date(date_from), _parse_date(date_to))
    from io import BytesIO
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=finance.xlsx"},
    )


@router.get("/export/payroll.xlsx")
def export_payroll(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if not _is_ceo(me):
        raise HTTPException(403, "Только для администраторов")
    data = export_payroll_xlsx(db, _parse_date(date_from), _parse_date(date_to))
    from io import BytesIO
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=payroll.xlsx"},
    )
