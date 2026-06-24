from datetime import date

from sqlalchemy.orm import Session

from app.models import PayrollRule, PayrollRecord, Deal, User


def get_rule_for(db: Session, employee_id: int, on_date: date) -> PayrollRule | None:
    return (
        db.query(PayrollRule)
        .filter(
            PayrollRule.employee_id == employee_id,
            PayrollRule.active_from <= on_date,
            (PayrollRule.active_to == None) | (PayrollRule.active_to >= on_date),
        )
        .order_by(PayrollRule.active_from.desc())
        .first()
    )


def calculate_payroll(
    db: Session,
    employee_id: int,
    period_start: date,
    period_end: date,
) -> dict:
    rule = get_rule_for(db, employee_id, period_end)
    base_salary = rule.base_salary if rule else 0

    setter_deals = (
        db.query(Deal)
        .filter(
            Deal.setter_id == employee_id,
            Deal.status == "paid",
            Deal.payment_date >= period_start,
            Deal.payment_date <= period_end,
            Deal.setter_commission > 0,
        )
        .all()
    )

    closer_deals = (
        db.query(Deal)
        .filter(
            Deal.closer_id == employee_id,
            Deal.status == "paid",
            Deal.payment_date >= period_start,
            Deal.payment_date <= period_end,
            Deal.closer_commission > 0,
        )
        .all()
    )

    deal_lines = []
    setter_commission_total = 0
    for d in setter_deals:
        setter_commission_total += d.setter_commission
        deal_lines.append({
            "deal_id": d.id,
            "role": "setter",
            "deal_amount": d.paid_amount,
            "commission": d.setter_commission,
            "payment_date": d.payment_date.isoformat() if d.payment_date else None,
            "deal_type": d.deal_type,
        })

    closer_commission_total = 0
    seen_deal_ids = {d.id for d in setter_deals}
    for d in closer_deals:
        closer_commission_total += d.closer_commission
        if d.id not in seen_deal_ids:
            deal_lines.append({
                "deal_id": d.id,
                "role": "closer",
                "deal_amount": d.paid_amount,
                "commission": d.closer_commission,
                "payment_date": d.payment_date.isoformat() if d.payment_date else None,
                "deal_type": d.deal_type,
            })

    commission_amount = setter_commission_total + closer_commission_total
    total = base_salary + commission_amount

    return {
        "employee_id": employee_id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "base_salary": base_salary,
        "commission_amount": commission_amount,
        "bonus_amount": 0,
        "penalty_amount": 0,
        "total_amount": total,
        "deals": deal_lines,
    }


def commit_payroll(
    db: Session,
    employee_id: int,
    period_start: date,
    period_end: date,
) -> PayrollRecord:
    data = calculate_payroll(db, employee_id, period_start, period_end)
    record = PayrollRecord(
        employee_id=employee_id,
        period_start=period_start,
        period_end=period_end,
        base_salary=data["base_salary"],
        commission_amount=data["commission_amount"],
        bonus_amount=0,
        penalty_amount=0,
        total_amount=data["total_amount"],
        status="draft",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
