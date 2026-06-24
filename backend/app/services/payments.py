import logging
from datetime import date

from sqlalchemy.orm import Session

from app.models import (
    Deal, Lead, FinanceTransaction, PayrollRule, Project, ProjectStatus,
)

logger = logging.getLogger(__name__)


def _get_rule(db: Session, employee_id: int, on_date: date, condition: str) -> PayrollRule | None:
    return (
        db.query(PayrollRule)
        .filter(
            PayrollRule.employee_id == employee_id,
            PayrollRule.commission_condition == condition,
            PayrollRule.active_from <= on_date,
            (PayrollRule.active_to == None) | (PayrollRule.active_to >= on_date),
        )
        .order_by(PayrollRule.active_from.desc())
        .first()
    )


def _get_any_rule(db: Session, employee_id: int, on_date: date) -> PayrollRule | None:
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


def on_deal_paid(db: Session, deal: Deal) -> None:
    lead: Lead | None = db.query(Lead).filter(Lead.id == deal.lead_id).first()
    pay_date: date = deal.payment_date or date.today()

    # ── (а) Доход ────────────────────────────────────────────────
    try:
        existing_income = (
            db.query(FinanceTransaction)
            .filter(
                FinanceTransaction.related_deal_id == deal.id,
                FinanceTransaction.type == "income",
            )
            .first()
        )
        if not existing_income:
            client = lead.company_name or lead.client_name if lead else f"сделка #{deal.id}"
            service_name = ""
            if lead and lead.service_id:
                from app.models import Service
                svc = db.query(Service).filter(Service.id == lead.service_id).first()
                service_name = f", {svc.name}" if svc else ""
            db.add(FinanceTransaction(
                type="income",
                category=None,
                amount=deal.paid_amount,
                date=pay_date,
                related_lead_id=deal.lead_id,
                related_deal_id=deal.id,
                payment_method=deal.payment_method,
                comment=f"Оплата сделки {client}{service_name}",
            ))
            db.flush()
            logger.info("Finance income created for deal %s, amount %s", deal.id, deal.paid_amount)
    except Exception:
        logger.exception("Failed to create income transaction for deal %s", deal.id)

    # ── (б) Комиссия сеттера ─────────────────────────────────────
    try:
        setter_comm = 0
        if deal.deal_type == "from_setter" and deal.setter_id:
            rule = _get_rule(db, deal.setter_id, pay_date, "from_setter")
            if not rule:
                rule = _get_any_rule(db, deal.setter_id, pay_date)
            if rule and rule.commission_percent:
                setter_comm = int(deal.paid_amount * rule.commission_percent / 100)
        deal.setter_commission = setter_comm
        db.flush()
        logger.info("Setter commission for deal %s: %s", deal.id, setter_comm)
    except Exception:
        logger.exception("Failed to calculate setter commission for deal %s", deal.id)

    # ── (в) Комиссия клоузера ────────────────────────────────────
    try:
        closer_comm = 0
        if deal.closer_id:
            condition = deal.deal_type if deal.deal_type in ("from_setter", "closer_self") else "any"
            rule = _get_rule(db, deal.closer_id, pay_date, condition)
            if not rule and condition != "any":
                rule = _get_rule(db, deal.closer_id, pay_date, "any")
            if not rule:
                rule = _get_any_rule(db, deal.closer_id, pay_date)
            if rule and rule.commission_percent:
                closer_comm = int(deal.paid_amount * rule.commission_percent / 100)
        deal.closer_commission = closer_comm
        db.flush()
        logger.info("Closer commission for deal %s: %s", deal.id, closer_comm)
    except Exception:
        logger.exception("Failed to calculate closer commission for deal %s", deal.id)

    # ── (г) Проект в разработке ──────────────────────────────────
    try:
        if deal.lead_id:
            existing_server = (
                db.query(Project)
                .filter(Project.lead_id == deal.lead_id)
                .first()
            )
            if not existing_server:
                service_name = ""
                company = ""
                if lead:
                    company = lead.company_name or lead.client_name
                    if lead.service_id:
                        from app.models import Service
                        svc = db.query(Service).filter(Service.id == lead.service_id).first()
                        service_name = svc.name if svc else ""
                db.add(Project(
                    company=company or f"Клиент #{deal.lead_id}",
                    status=ProjectStatus.new,
                    sub_status="Сбор информации",
                    price=0,
                    lead_id=deal.lead_id,
                    bot_comment=f"Из сделки, услуга: {service_name}",
                ))
                db.flush()
                logger.info("Project created for lead %s", deal.lead_id)
            else:
                logger.info("Project already exists for lead %s, skipping", deal.lead_id)
    except Exception:
        logger.exception("Failed to create server project for deal %s", deal.id)
