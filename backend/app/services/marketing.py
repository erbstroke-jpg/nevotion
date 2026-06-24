"""Marketing metrics service — CPL / CAC / ROMI per lead source."""
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AdExpense, Lead, Deal, LeadStage, LeadSource

BISHKEK_OFFSET = timezone(timedelta(hours=6))


def _today_bishkek() -> date:
    return datetime.now(BISHKEK_OFFSET).date()


def _month_start_bishkek() -> date:
    d = _today_bishkek()
    return d.replace(day=1)


def source_metrics(db: Session, date_from: Optional[date], date_to: Optional[date]) -> list[dict]:
    sources = db.query(LeadSource).order_by(LeadSource.position).all()

    # won stage ids
    won_stage_ids = {s.id for s in db.query(LeadStage).filter(LeadStage.is_won == True).all()}

    results = []
    for src in sources:
        # ad spend
        spend_q = db.query(func.coalesce(func.sum(AdExpense.amount), 0)).filter(
            AdExpense.source_id == src.id
        )
        if date_from:
            spend_q = spend_q.filter(AdExpense.date >= date_from)
        if date_to:
            spend_q = spend_q.filter(AdExpense.date <= date_to)
        spend = spend_q.scalar() or 0

        # leads from this source in period
        leads_q = db.query(Lead).filter(Lead.source_id == src.id)
        if date_from:
            leads_q = leads_q.filter(func.date(Lead.created_at) >= date_from)
        if date_to:
            leads_q = leads_q.filter(func.date(Lead.created_at) <= date_to)
        lead_ids = [l.id for l in leads_q.all()]
        leads_count = len(lead_ids)

        # paid deals from those leads
        paid_deals = []
        revenue = 0
        if lead_ids:
            paid_deals_q = db.query(Deal).filter(
                Deal.lead_id.in_(lead_ids),
                Deal.status == "paid",
            )
            paid_deals = paid_deals_q.all()
            revenue = sum(d.paid_amount for d in paid_deals)

        # also count leads that reached a won stage
        won_leads_count = 0
        if lead_ids and won_stage_ids:
            won_leads_count = db.query(Lead).filter(
                Lead.id.in_(lead_ids),
                Lead.stage_id.in_(won_stage_ids),
            ).count()

        paid_count = max(len(paid_deals), won_leads_count)

        cpl = (spend / leads_count) if leads_count > 0 else 0
        cac = (spend / paid_count) if paid_count > 0 else 0
        romi = ((revenue - spend) / spend * 100) if spend > 0 else None
        conversion = (paid_count / leads_count * 100) if leads_count > 0 else 0

        results.append({
            "source_id": src.id,
            "source_name": src.name,
            "spend": spend,
            "leads_count": leads_count,
            "paid_count": paid_count,
            "revenue": revenue,
            "cpl": round(cpl),
            "cac": round(cac),
            "romi": round(romi, 1) if romi is not None else None,
            "conversion_pct": round(conversion, 1),
        })

    return results


def marketing_totals(db: Session, date_from: Optional[date], date_to: Optional[date]) -> dict:
    today = _today_bishkek()
    month_start = _month_start_bishkek()

    # spend today
    spend_today = db.query(func.coalesce(func.sum(AdExpense.amount), 0)).filter(
        AdExpense.date == today
    ).scalar() or 0

    # spend this month
    spend_month = db.query(func.coalesce(func.sum(AdExpense.amount), 0)).filter(
        AdExpense.date >= month_start,
        AdExpense.date <= today,
    ).scalar() or 0

    # spend in custom period
    spend_q = db.query(func.coalesce(func.sum(AdExpense.amount), 0))
    if date_from:
        spend_q = spend_q.filter(AdExpense.date >= date_from)
    if date_to:
        spend_q = spend_q.filter(AdExpense.date <= date_to)
    spend_period = spend_q.scalar() or 0

    # leads in period
    leads_q = db.query(Lead)
    if date_from:
        leads_q = leads_q.filter(func.date(Lead.created_at) >= date_from)
    if date_to:
        leads_q = leads_q.filter(func.date(Lead.created_at) <= date_to)
    leads_total = leads_q.count()

    # paid deals in period
    deals_q = db.query(Deal).filter(Deal.status == "paid")
    if date_from:
        deals_q = deals_q.filter(Deal.payment_date >= date_from)
    if date_to:
        deals_q = deals_q.filter(Deal.payment_date <= date_to)
    paid_deals = deals_q.all()
    paid_count = len(paid_deals)
    revenue = sum(d.paid_amount for d in paid_deals)

    cpl = round(spend_period / leads_total) if leads_total > 0 else 0
    cac = round(spend_period / paid_count) if paid_count > 0 else 0
    romi = round((revenue - spend_period) / spend_period * 100, 1) if spend_period > 0 else None

    return {
        "spend_today": spend_today,
        "spend_month": spend_month,
        "spend_period": spend_period,
        "leads_total": leads_total,
        "paid_count": paid_count,
        "revenue": revenue,
        "cpl": cpl,
        "cac": cac,
        "romi": romi,
    }
