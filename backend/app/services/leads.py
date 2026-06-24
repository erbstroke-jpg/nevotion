from datetime import datetime, date, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import Lead, LeadStageHistory, LeadActivity, LeadStage, Meeting, Deal


def create_lead_activity(
    db: Session,
    lead_id: int,
    activity_type: str,
    channel: str = "",
    description: str = "",
    responsible_id: int | None = None,
) -> LeadActivity:
    activity = LeadActivity(
        lead_id=lead_id,
        activity_type=activity_type,
        channel=channel,
        description=description,
        responsible_id=responsible_id,
    )
    db.add(activity)
    db.flush()
    return activity


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    try:
        return date.fromisoformat(val[:10])
    except Exception:
        return None


def _get_active_deal(db: Session, lead_id: int) -> Deal | None:
    return (
        db.query(Deal)
        .filter(Deal.lead_id == lead_id, Deal.status == "pending")
        .order_by(Deal.created_at.desc())
        .first()
    )


def _stage_kind(stage: LeadStage) -> str:
    name = stage.name.lower()
    if stage.is_lost or "минус" in name:
        return "lost"
    if stage.is_won or "оплач" in name:
        return "won"
    if "встреч" in name:
        return "meeting"
    if "договор" in name:
        return "contract"
    if "ожидани" in name or "ожид" in name:
        return "waiting_payment"
    return "generic"


def change_lead_stage(
    db: Session,
    lead: Lead,
    to_stage_id: int | None,
    changed_by: int | None = None,
    comment: str = "",
    extra_data: dict | None = None,
) -> LeadStageHistory:
    extra_data = extra_data or {}

    entry = LeadStageHistory(
        lead_id=lead.id,
        from_stage_id=lead.stage_id,
        to_stage_id=to_stage_id,
        changed_by=changed_by,
        comment=comment,
    )
    db.add(entry)
    lead.stage_id = to_stage_id
    lead.updated_at = datetime.now(timezone.utc)

    if to_stage_id:
        stage = db.query(LeadStage).filter(LeadStage.id == to_stage_id).first()
        if stage:
            kind = _stage_kind(stage)

            if kind == "meeting":
                _handle_meeting_stage(db, lead, changed_by, extra_data)

            elif kind == "contract":
                _handle_contract_stage(db, lead, changed_by, extra_data)

            elif kind == "waiting_payment":
                _handle_waiting_payment_stage(db, lead, changed_by, extra_data)

            elif kind == "won":
                _handle_won_stage(db, lead, changed_by, extra_data)

            elif kind == "lost":
                _handle_lost_stage(db, lead, changed_by, extra_data)

    create_lead_activity(
        db,
        lead_id=lead.id,
        activity_type="stage_change",
        description=f"Этап изменён",
        responsible_id=changed_by,
    )
    db.flush()
    return entry


def _handle_meeting_stage(db: Session, lead: Lead, changed_by: int | None, extra: dict) -> None:
    meeting_date_str = extra.get("meeting_date") or extra.get("date")
    meeting_time_str = extra.get("meeting_time") or extra.get("time", "00:00")
    address = extra.get("address", "")
    closer_id = extra.get("closer_id") or lead.closer_id
    setter_id = extra.get("setter_id") or lead.setter_id

    if meeting_date_str:
        try:
            dt_str = f"{meeting_date_str[:10]}T{meeting_time_str or '00:00'}:00"
            meeting_dt = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
        except Exception:
            meeting_dt = datetime.now(timezone.utc)
    else:
        meeting_dt = datetime.now(timezone.utc)

    m = Meeting(
        lead_id=lead.id,
        client_name=lead.client_name,
        client_phone=lead.phone,
        meeting_date=meeting_dt,
        address=address,
        closer_id=closer_id,
        setter_id=setter_id,
    )
    db.add(m)
    db.flush()


def _handle_contract_stage(db: Session, lead: Lead, changed_by: int | None, extra: dict) -> None:
    amount = extra.get("amount") or lead.potential_amount or 0
    contract_sent_at = _parse_date(extra.get("contract_sent_at"))
    expected_payment_date = _parse_date(extra.get("expected_payment_date"))
    responsible_id = extra.get("responsible_id") or changed_by

    deal = _get_active_deal(db, lead.id)
    if deal:
        deal.amount = amount
        if contract_sent_at:
            deal.contract_sent_at = contract_sent_at
        if expected_payment_date:
            deal.expected_payment_date = expected_payment_date
        if responsible_id:
            deal.responsible_id = responsible_id
        deal.updated_at = datetime.now(timezone.utc)
    else:
        db.add(Deal(
            lead_id=lead.id,
            amount=amount,
            contract_sent_at=contract_sent_at,
            expected_payment_date=expected_payment_date,
            responsible_id=responsible_id,
        ))
    if amount:
        lead.potential_amount = amount
    db.flush()


def _handle_waiting_payment_stage(db: Session, lead: Lead, changed_by: int | None, extra: dict) -> None:
    amount = extra.get("amount") or lead.potential_amount or 0
    expected_payment_date = _parse_date(extra.get("expected_payment_date"))
    responsible_id = extra.get("responsible_id") or changed_by

    deal = _get_active_deal(db, lead.id)
    if deal:
        if amount:
            deal.amount = amount
        if expected_payment_date:
            deal.expected_payment_date = expected_payment_date
        if responsible_id:
            deal.responsible_id = responsible_id
        deal.updated_at = datetime.now(timezone.utc)
    else:
        db.add(Deal(
            lead_id=lead.id,
            amount=amount,
            expected_payment_date=expected_payment_date,
            responsible_id=responsible_id,
        ))
    if amount:
        lead.potential_amount = amount
    db.flush()


def _handle_won_stage(db: Session, lead: Lead, changed_by: int | None, extra: dict) -> None:
    paid_amount = extra.get("paid_amount") or extra.get("amount") or lead.potential_amount or 0
    payment_date = _parse_date(extra.get("payment_date"))
    payment_method = extra.get("payment_method", "")
    setter_id = extra.get("setter_id") or lead.setter_id
    closer_id = extra.get("closer_id") or lead.closer_id
    deal_type = extra.get("deal_type", "")

    deal = _get_active_deal(db, lead.id)
    if deal:
        deal.paid_amount = paid_amount
        if payment_date:
            deal.payment_date = payment_date
        deal.payment_method = payment_method
        if setter_id:
            deal.setter_id = setter_id
        if closer_id:
            deal.closer_id = closer_id
        deal.deal_type = deal_type
        deal.status = "paid"
        deal.updated_at = datetime.now(timezone.utc)
    else:
        deal = Deal(
            lead_id=lead.id,
            amount=paid_amount,
            paid_amount=paid_amount,
            payment_date=payment_date,
            payment_method=payment_method,
            setter_id=setter_id,
            closer_id=closer_id,
            deal_type=deal_type,
            status="paid",
        )
        db.add(deal)
    lead.actual_amount = paid_amount
    db.flush()

    from app.services.payments import on_deal_paid
    on_deal_paid(db, deal)


def _handle_lost_stage(db: Session, lead: Lead, changed_by: int | None, extra: dict) -> None:
    reject_reason_id = extra.get("reject_reason_id")
    reject_comment = extra.get("reject_comment", "")
    closer_id = extra.get("closer_id") or lead.closer_id

    if reject_reason_id:
        lead.reject_reason_id = reject_reason_id
    if reject_comment:
        lead.reject_comment = reject_comment
    if closer_id:
        lead.closer_id = closer_id
    db.flush()


def add_activity(
    db: Session,
    lead: Lead,
    activity_type: str,
    channel: str = "",
    description: str = "",
    responsible_id: int | None = None,
) -> LeadActivity:
    return create_lead_activity(
        db,
        lead_id=lead.id,
        activity_type=activity_type,
        channel=channel,
        description=description,
        responsible_id=responsible_id,
    )


def get_lead_timeline(db: Session, lead: Lead) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    events.append({
        "type": "created",
        "label": "Лид создан",
        "description": f"Клиент: {lead.client_name}",
        "at": lead.created_at.isoformat() if lead.created_at else None,
        "icon": "person_add",
    })

    history = (
        db.query(LeadStageHistory)
        .filter(LeadStageHistory.lead_id == lead.id)
        .order_by(LeadStageHistory.created_at)
        .all()
    )
    from app.models import User
    stages = {s.id: s.name for s in db.query(LeadStage).all()}
    users = {u.id: u.name for u in db.query(User).filter(User.id.in_([h.changed_by for h in history if h.changed_by])).all()}

    for h in history:
        from_name = stages.get(h.from_stage_id, "—") if h.from_stage_id else "—"
        to_name = stages.get(h.to_stage_id, "—") if h.to_stage_id else "—"
        by_name = users.get(h.changed_by, "") if h.changed_by else ""
        events.append({
            "type": "stage_change",
            "label": f"Этап: {from_name} → {to_name}",
            "description": h.comment or (f"Изменил: {by_name}" if by_name else ""),
            "at": h.created_at.isoformat() if h.created_at else None,
            "icon": "swap_horiz",
            "by": by_name,
        })

    events.sort(key=lambda e: e.get("at") or "")
    return events
