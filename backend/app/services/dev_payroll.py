"""Dev department payroll calculation (prompters, teamlead, backenders)."""
from datetime import date

from sqlalchemy.orm import Session

from app.models import Project, ProjectStatus, User, DevPayrollConfig
from app.services.payroll import get_rule_for

# Canonical position strings for dev roles — single source of truth
_DEV_POSITIONS = {
    "prompter": {"Промпт-инженер"},
    "teamlead": {"Тимлид"},
    "backender": {"Бэкенд", "Главный тех лид"},
}

_ALL_DEV_POSITIONS = {p for ps in _DEV_POSITIONS.values() for p in ps}


def is_dev_position(position: str) -> bool:
    return position in _ALL_DEV_POSITIONS


def _get_config(db: Session, role_kind: str) -> DevPayrollConfig | None:
    return db.query(DevPayrollConfig).filter(DevPayrollConfig.role_kind == role_kind).first()


def calculate_prompter_salary(
    db: Session, user: User, period_start: date, period_end: date
) -> dict:
    config = _get_config(db, "prompter")
    if not config:
        return _empty(user.id, period_start, period_end)

    # Bots delivered (sub_status=Сдан) within period by delivered_at date
    delivered = (
        db.query(Project)
        .filter(
            Project.owner_id == user.id,
            Project.status == ProjectStatus.new,
            Project.sub_status == "Сдан",
            Project.delivered_at != None,
            Project.delivered_at >= period_start,
            Project.delivered_at <= period_end,
        )
        .order_by(Project.delivered_at)
        .all()
    )

    # Support bots (current status, not period-bound)
    support_bots = (
        db.query(Project)
        .filter(Project.owner_id == user.id, Project.status == ProjectStatus.support)
        .all()
    )
    support_count = len(support_bots)

    bot_lines = []
    commission = 0
    for i, s in enumerate(delivered):
        # Per-bot price: Project.price if > 0, else global new_bot_price
        price = s.price if s.price > 0 else config.new_bot_price
        in_limit = i < config.free_bots_limit
        if not in_limit:
            commission += price
        bot_lines.append({
            "project_id": s.id,
            "company": s.company,
            "delivered_at": s.delivered_at.isoformat() if s.delivered_at else None,
            "price": price,
            "in_free_limit": in_limit,
        })

    support_total = support_count * config.support_price
    total = config.base_salary + commission + support_total

    return {
        "employee_id": user.id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "base_salary": config.base_salary,
        "commission_amount": commission + support_total,
        "bonus_amount": 0,
        "penalty_amount": 0,
        "total_amount": total,
        "deals": [],
        "dev_breakdown": {
            "kind": "prompter",
            "bots": bot_lines,
            "support_count": support_count,
            "support_price": config.support_price,
            "support_total": support_total,
            "free_bots_limit": config.free_bots_limit,
        },
    }


def calculate_teamlead_salary(
    db: Session, user: User, period_start: date, period_end: date
) -> dict:
    config = _get_config(db, "teamlead")
    if not config:
        return _empty(user.id, period_start, period_end)

    delivered = (
        db.query(Project)
        .filter(
            Project.owner_id == user.id,
            Project.status == ProjectStatus.new,
            Project.sub_status == "Сдан",
            Project.delivered_at != None,
            Project.delivered_at >= period_start,
            Project.delivered_at <= period_end,
        )
        .order_by(Project.delivered_at)
        .all()
    )

    support_bots = (
        db.query(Project)
        .filter(Project.owner_id == user.id, Project.status == ProjectStatus.support)
        .all()
    )
    support_count = len(support_bots)

    bot_lines = []
    commission = 0
    for i, s in enumerate(delivered):
        price = s.price if s.price > 0 else config.new_bot_price
        in_limit = i < config.free_bots_limit  # teamlead free_bots_limit=0 so always false
        if not in_limit:
            commission += price
        bot_lines.append({
            "project_id": s.id,
            "company": s.company,
            "delivered_at": s.delivered_at.isoformat() if s.delivered_at else None,
            "price": price,
            "in_free_limit": in_limit,
        })

    support_total = support_count * config.support_price
    total = config.base_salary + commission + support_total

    return {
        "employee_id": user.id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "base_salary": config.base_salary,
        "commission_amount": commission + support_total,
        "bonus_amount": 0,
        "penalty_amount": 0,
        "total_amount": total,
        "deals": [],
        "dev_breakdown": {
            "kind": "teamlead",
            "bots": bot_lines,
            "support_count": support_count,
            "support_price": config.support_price,
            "support_total": support_total,
            "free_bots_limit": config.free_bots_limit,
        },
    }


def calculate_backender_salary(
    db: Session, user: User, period_start: date, period_end: date
) -> dict:
    # Backenders get a fixed salary from PayrollRule (commission_condition=none)
    rule = get_rule_for(db, user.id, period_end)
    base = rule.base_salary if rule else 0

    return {
        "employee_id": user.id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "base_salary": base,
        "commission_amount": 0,
        "bonus_amount": 0,
        "penalty_amount": 0,
        "total_amount": base,
        "deals": [],
        "dev_breakdown": {"kind": "backender"},
    }


def calculate_dev_salary(
    db: Session, user: User, period_start: date, period_end: date
) -> dict | None:
    if user.position in _DEV_POSITIONS["prompter"]:
        return calculate_prompter_salary(db, user, period_start, period_end)
    if user.position in _DEV_POSITIONS["teamlead"]:
        return calculate_teamlead_salary(db, user, period_start, period_end)
    if user.position in _DEV_POSITIONS["backender"]:
        return calculate_backender_salary(db, user, period_start, period_end)
    return None


def _empty(employee_id: int, period_start: date, period_end: date) -> dict:
    return {
        "employee_id": employee_id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "base_salary": 0,
        "commission_amount": 0,
        "bonus_amount": 0,
        "penalty_amount": 0,
        "total_amount": 0,
        "deals": [],
    }
