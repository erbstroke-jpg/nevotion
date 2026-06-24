from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models import PayrollRule, PayrollRecord, User, DevPayrollConfig
from app.services.payroll import calculate_payroll, commit_payroll
from app.services.dev_payroll import is_dev_position, calculate_dev_salary

router = APIRouter(prefix="/api/payroll", tags=["payroll"])


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    try:
        return date.fromisoformat(val[:10])
    except Exception:
        return None


def _rule_dict(r: PayrollRule) -> dict:
    return {
        "id": r.id,
        "employee_id": r.employee_id,
        "base_salary": r.base_salary,
        "commission_percent": r.commission_percent,
        "commission_condition": r.commission_condition,
        "active_from": r.active_from.isoformat() if r.active_from else None,
        "active_to": r.active_to.isoformat() if r.active_to else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "employee": {"id": r.employee.id, "name": r.employee.name} if r.employee else None,
    }


def _record_dict(r: PayrollRecord) -> dict:
    return {
        "id": r.id,
        "employee_id": r.employee_id,
        "period_start": r.period_start.isoformat() if r.period_start else None,
        "period_end": r.period_end.isoformat() if r.period_end else None,
        "base_salary": r.base_salary,
        "commission_amount": r.commission_amount,
        "bonus_amount": r.bonus_amount,
        "penalty_amount": r.penalty_amount,
        "total_amount": r.total_amount,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "employee": {"id": r.employee.id, "name": r.employee.name} if r.employee else None,
    }


# ─── Rules ──────────────────────────────────────────────────────

class RuleIn(BaseModel):
    employee_id: int
    base_salary: int = 0
    commission_percent: int = 0
    commission_condition: str = "none"
    active_from: str
    active_to: Optional[str] = None


@router.get("/rules")
def list_rules(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    is_admin = me.role == "admin" or me.is_founder
    q = db.query(PayrollRule)
    if not is_admin:
        # Staff can only see their own rules
        q = q.filter(PayrollRule.employee_id == me.id)
    elif employee_id:
        q = q.filter(PayrollRule.employee_id == employee_id)
    return [_rule_dict(r) for r in q.order_by(PayrollRule.active_from.desc()).all()]


@router.post("/rules")
def create_rule(body: RuleIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if me.role != "admin" and not me.is_founder:
        raise HTTPException(403, "Нет доступа")
    rule = PayrollRule(
        employee_id=body.employee_id,
        base_salary=body.base_salary,
        commission_percent=body.commission_percent,
        commission_condition=body.commission_condition,
        active_from=_parse_date(body.active_from),
        active_to=_parse_date(body.active_to),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_dict(rule)


@router.put("/rules/{rule_id}")
def update_rule(
    rule_id: int,
    body: RuleIn,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if me.role != "admin" and not me.is_founder:
        raise HTTPException(403, "Нет доступа")
    rule = db.query(PayrollRule).filter(PayrollRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404)
    rule.employee_id = body.employee_id
    rule.base_salary = body.base_salary
    rule.commission_percent = body.commission_percent
    rule.commission_condition = body.commission_condition
    rule.active_from = _parse_date(body.active_from)
    rule.active_to = _parse_date(body.active_to)
    db.commit()
    db.refresh(rule)
    return _rule_dict(rule)


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if me.role != "admin" and not me.is_founder:
        raise HTTPException(403, "Нет доступа")
    rule = db.query(PayrollRule).filter(PayrollRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404)
    db.delete(rule)
    db.commit()


# ─── Calculate (preview) ────────────────────────────────────────

@router.get("/calculate")
def calculate(
    period_start: str = Query(...),
    period_end: str = Query(...),
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    is_admin = me.role == "admin" or me.is_founder
    if not is_admin and employee_id and employee_id != me.id:
        raise HTTPException(403, "Нет доступа")

    d_from = _parse_date(period_start)
    d_to = _parse_date(period_end)
    if not d_from or not d_to:
        raise HTTPException(400, "Неверный формат даты")

    if employee_id:
        user = db.query(User).filter(User.id == employee_id).first()
        if user and is_dev_position(user.position):
            return calculate_dev_salary(db, user, d_from, d_to) or calculate_payroll(db, employee_id, d_from, d_to)
        return calculate_payroll(db, employee_id, d_from, d_to)

    if not is_admin:
        if is_dev_position(me.position):
            return calculate_dev_salary(db, me, d_from, d_to) or calculate_payroll(db, me.id, d_from, d_to)
        return calculate_payroll(db, me.id, d_from, d_to)

    users = db.query(User).filter(User.is_active == True).all()
    results = []
    for u in users:
        if is_dev_position(u.position):
            r = calculate_dev_salary(db, u, d_from, d_to)
            if r:
                results.append(r)
        else:
            results.append(calculate_payroll(db, u.id, d_from, d_to))
    return results


# ─── Commit ─────────────────────────────────────────────────────

class CommitIn(BaseModel):
    employee_id: int
    period_start: str
    period_end: str


@router.post("/commit")
def commit(body: CommitIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if me.role != "admin" and not me.is_founder:
        raise HTTPException(403, "Нет доступа")
    d_from = _parse_date(body.period_start)
    d_to = _parse_date(body.period_end)
    if not d_from or not d_to:
        raise HTTPException(400, "Неверный формат даты")
    record = commit_payroll(db, body.employee_id, d_from, d_to)
    return _record_dict(record)


# ─── Records ────────────────────────────────────────────────────

@router.get("/records")
def list_records(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    is_admin = me.role == "admin" or me.is_founder
    q = db.query(PayrollRecord)
    if not is_admin:
        q = q.filter(PayrollRecord.employee_id == me.id)
    elif employee_id:
        q = q.filter(PayrollRecord.employee_id == employee_id)
    records = q.order_by(PayrollRecord.period_start.desc()).all()
    return [_record_dict(r) for r in records]


@router.put("/records/{rec_id}/status")
def update_record_status(
    rec_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if me.role != "admin" and not me.is_founder:
        raise HTTPException(403, "Нет доступа")
    rec = db.query(PayrollRecord).filter(PayrollRecord.id == rec_id).first()
    if not rec:
        raise HTTPException(404)
    if status not in ("draft", "paid"):
        raise HTTPException(400, "Неверный статус")
    rec.status = status
    db.commit()
    db.refresh(rec)
    return _record_dict(rec)


# ─── Dev Payroll Config ─────────────────────────────────────────

def _config_dict(c: DevPayrollConfig) -> dict:
    return {
        "id": c.id,
        "role_kind": c.role_kind,
        "new_bot_price": c.new_bot_price,
        "support_price": c.support_price,
        "base_salary": c.base_salary,
        "free_bots_limit": c.free_bots_limit,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


class DevConfigIn(BaseModel):
    new_bot_price: int
    support_price: int
    base_salary: int
    free_bots_limit: int


@router.get("/dev-config")
def list_dev_configs(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    return [_config_dict(c) for c in db.query(DevPayrollConfig).all()]


@router.put("/dev-config/{config_id}")
def update_dev_config(
    config_id: int,
    body: DevConfigIn,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if me.role != "admin" and not me.is_founder:
        raise HTTPException(403, "Нет доступа")
    cfg = db.query(DevPayrollConfig).filter(DevPayrollConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(404)
    cfg.new_bot_price = body.new_bot_price
    cfg.support_price = body.support_price
    cfg.base_salary = body.base_salary
    cfg.free_bots_limit = body.free_bots_limit
    from datetime import datetime, timezone
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)
    return _config_dict(cfg)
