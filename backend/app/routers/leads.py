from datetime import datetime, date, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, and_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import (
    Lead, LeadStageHistory, LeadActivity, LeadFile,
    LeadSource, Service, LeadStage, Meeting, Task,
    User, Role, LeadStatus, Deal, RejectReason,
)
from app.schemas import UserOut
from app.services.leads import change_lead_stage, add_activity, get_lead_timeline

router = APIRouter(prefix="/api/leads", tags=["leads"])


# ─────────────────────────── Schemas ────────────────────────────

class LeadSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; name: str; is_active: bool; position: int


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; name: str; is_active: bool; position: int


class LeadStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; name: str; position: int; norm_days: Optional[int]; is_won: bool; is_lost: bool; color: str


class LeadActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int
    activity_type: str
    channel: str
    description: str
    responsible_id: Optional[int]
    responsible: Optional[UserOut] = None
    created_at: datetime


class LeadStageHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int
    from_stage_id: Optional[int]
    to_stage_id: Optional[int]
    changed_by: Optional[int]
    comment: str
    created_at: datetime


class LeadFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int
    name: str
    url: str
    file_type: str
    uploaded_by: Optional[int]
    uploader: Optional[UserOut] = None
    created_at: datetime


class MeetingBriefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    meeting_date: datetime
    client_name: str
    status: str
    closer: Optional[UserOut] = None
    setter: Optional[UserOut] = None


class TaskBriefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    priority: str
    due_date: Optional[date]
    completed_at: Optional[date]
    owner: Optional[UserOut] = None


class DealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lead_id: int
    amount: int
    paid_amount: int
    payment_date: Optional[date]
    payment_method: str
    status: str
    setter_id: Optional[int]
    closer_id: Optional[int]
    deal_type: str
    contract_sent_at: Optional[date]
    expected_payment_date: Optional[date]
    responsible_id: Optional[int]
    created_at: datetime
    updated_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_name: str
    company_name: str
    phone: str
    whatsapp: str
    instagram: str
    email: str
    address: str
    website: str
    industry: str
    employees_count: Optional[int]
    source_id: Optional[int]
    service_id: Optional[int]
    stage_id: Optional[int]
    setter_id: Optional[int]
    closer_id: Optional[int]
    potential_amount: int
    actual_amount: int
    status: LeadStatus
    next_action_type: str
    next_action_at: Optional[datetime]
    comment: str
    reject_reason_id: Optional[int] = None
    reject_comment: str = ""
    created_at: datetime
    updated_at: datetime
    source: Optional[LeadSourceOut] = None
    service: Optional[ServiceOut] = None
    stage: Optional[LeadStageOut] = None
    setter: Optional[UserOut] = None
    closer: Optional[UserOut] = None
    active_deal: Optional[DealOut] = None


class LeadDetailOut(LeadOut):
    stage_history: list[LeadStageHistoryOut] = []
    activities: list[LeadActivityOut] = []
    meetings: list[MeetingBriefOut] = []
    tasks: list[TaskBriefOut] = []
    files: list[LeadFileOut] = []
    timeline: list[dict] = []


class LeadCreate(BaseModel):
    client_name: str
    company_name: str = ""
    phone: str = ""
    whatsapp: str = ""
    instagram: str = ""
    email: str = ""
    address: str = ""
    website: str = ""
    industry: str = ""
    employees_count: Optional[int] = None
    source_id: Optional[int] = None
    service_id: Optional[int] = None
    stage_id: Optional[int] = None
    setter_id: Optional[int] = None
    closer_id: Optional[int] = None
    potential_amount: int = 0
    comment: str = ""
    next_action_type: str = ""
    next_action_at: Optional[datetime] = None
    force: bool = False


class LeadUpdate(BaseModel):
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    instagram: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    employees_count: Optional[int] = None
    source_id: Optional[int] = None
    service_id: Optional[int] = None
    stage_id: Optional[int] = None
    setter_id: Optional[int] = None
    closer_id: Optional[int] = None
    potential_amount: Optional[int] = None
    actual_amount: Optional[int] = None
    status: Optional[LeadStatus] = None
    next_action_type: Optional[str] = None
    next_action_at: Optional[datetime] = None
    comment: Optional[str] = None


class StageChangeIn(BaseModel):
    to_stage_id: int
    comment: str = ""
    extra_data: dict = {}


class ActivityCreate(BaseModel):
    activity_type: str
    channel: str = ""
    description: str = ""
    responsible_id: Optional[int] = None


class FileCreate(BaseModel):
    name: str
    url: str
    file_type: str = ""


class LeadListResponse(BaseModel):
    items: list[LeadOut]
    total: int


class LeadStats(BaseModel):
    leads_today: int
    leads_period: int
    meetings_period: int
    closed_won: int
    conversion_pct: float
    potential_sum: int
    cpl: Optional[float] = None


class FunnelStats(BaseModel):
    new_leads: int
    meetings_stage: int
    contracts_sent: int
    waiting_payment: int
    closed_won: int
    conversion_pct: float
    potential_sum: int


class FunnelCardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_name: str
    company_name: str
    stage_id: Optional[int]
    source_id: Optional[int]
    service_id: Optional[int]
    setter_id: Optional[int]
    closer_id: Optional[int]
    potential_amount: int
    actual_amount: int
    next_action_type: str
    next_action_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    source: Optional[LeadSourceOut] = None
    service: Optional[ServiceOut] = None
    stage: Optional[LeadStageOut] = None
    setter: Optional[UserOut] = None
    closer: Optional[UserOut] = None
    days_in_stage: int = 0
    active_deal: Optional[DealOut] = None


class FunnelResponse(BaseModel):
    leads: list[FunnelCardOut]
    stages: list[LeadStageOut]


# ─────────────────────────── Helpers ────────────────────────────

def _load_lead(db: Session, lead_id: int) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Лид не найден")
    return lead


def _eager_lead(db: Session):
    return db.query(Lead).options(
        joinedload(Lead.source),
        joinedload(Lead.service),
        joinedload(Lead.stage),
        joinedload(Lead.setter),
        joinedload(Lead.closer),
    )


def _attach_active_deal(lead_out: dict, db: Session) -> dict:
    deal = (
        db.query(Deal)
        .filter(Deal.lead_id == lead_out["id"])
        .order_by(Deal.created_at.desc())
        .first()
    )
    lead_out["active_deal"] = deal
    return lead_out


def _lead_to_dict(lead: Lead) -> dict:
    return {c.key: getattr(lead, c.key) for c in lead.__table__.columns}


# ─────────────────────────── Routes ────────────────────────────

@router.get("/stats", response_model=LeadStats)
def lead_stats(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    q_base = db.query(Lead).filter(Lead.status == LeadStatus.active)

    # filter by period
    q_period = q_base
    if date_from:
        df = datetime.fromisoformat(date_from)
        q_period = q_period.filter(Lead.created_at >= df)
    if date_to:
        dt = datetime.fromisoformat(date_to)
        q_period = q_period.filter(Lead.created_at < dt)

    leads_today = db.query(func.count(Lead.id)).filter(
        Lead.status == LeadStatus.active,
        func.date(Lead.created_at) == today,
    ).scalar() or 0

    leads_period = q_period.count()

    # meetings count in period
    q_meetings = db.query(func.count(Meeting.id)).filter(Meeting.lead_id.isnot(None))
    if date_from:
        q_meetings = q_meetings.filter(Meeting.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q_meetings = q_meetings.filter(Meeting.created_at < datetime.fromisoformat(date_to))
    meetings_period = q_meetings.scalar() or 0

    # won stage leads
    won_stage_ids = [s.id for s in db.query(LeadStage).filter(LeadStage.is_won == True).all()]
    closed_won = q_period.filter(Lead.stage_id.in_(won_stage_ids)).count() if won_stage_ids else 0

    conversion_pct = round(closed_won / leads_period * 100, 1) if leads_period > 0 else 0.0

    # potential sum (active, non-won, non-lost)
    lost_stage_ids = [s.id for s in db.query(LeadStage).filter(LeadStage.is_lost == True).all()]
    exclude_ids = won_stage_ids + lost_stage_ids
    pot_q = db.query(func.coalesce(func.sum(Lead.potential_amount), 0)).filter(
        Lead.status == LeadStatus.active,
        Lead.stage_id.notin_(exclude_ids) if exclude_ids else True,
    )
    potential_sum = pot_q.scalar() or 0

    return LeadStats(
        leads_today=leads_today,
        leads_period=leads_period,
        meetings_period=meetings_period,
        closed_won=closed_won,
        conversion_pct=conversion_pct,
        potential_sum=potential_sum,
    )


@router.get("", response_model=LeadListResponse)
def list_leads(
    source_id: Optional[int] = Query(None),
    service_id: Optional[int] = Query(None),
    setter_id: Optional[int] = Query(None),
    closer_id: Optional[int] = Query(None),
    stage_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(30, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = _eager_lead(db)
    if source_id:
        q = q.filter(Lead.source_id == source_id)
    if service_id:
        q = q.filter(Lead.service_id == service_id)
    if setter_id:
        q = q.filter(Lead.setter_id == setter_id)
    if closer_id:
        q = q.filter(Lead.closer_id == closer_id)
    if stage_id:
        q = q.filter(Lead.stage_id == stage_id)
    if status:
        q = q.filter(Lead.status == status)
    else:
        q = q.filter(Lead.status == LeadStatus.active)
    if date_from:
        q = q.filter(Lead.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Lead.created_at < datetime.fromisoformat(date_to))
    if search:
        s = f"%{search}%"
        q = q.filter(
            Lead.client_name.ilike(s) |
            Lead.company_name.ilike(s) |
            Lead.phone.ilike(s)
        )

    total = q.count()
    items = q.order_by(Lead.created_at.desc()).offset(offset).limit(limit).all()
    return LeadListResponse(items=items, total=total)


# ─────────────────────────── Funnel (must be before /{lead_id}) ──

@router.get("/funnel-stats", response_model=FunnelStats)
def funnel_stats(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    source_id: Optional[int] = Query(None),
    setter_id: Optional[int] = Query(None),
    closer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stages = db.query(LeadStage).order_by(LeadStage.position).all()
    stage_map = {s.id: s for s in stages}

    q = db.query(Lead).filter(Lead.status == LeadStatus.active)
    if date_from:
        q = q.filter(Lead.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Lead.created_at < datetime.fromisoformat(date_to))
    if source_id:
        q = q.filter(Lead.source_id == source_id)
    if setter_id:
        q = q.filter(Lead.setter_id == setter_id)
    if closer_id:
        q = q.filter(Lead.closer_id == closer_id)

    leads = q.all()

    from app.services.leads import _stage_kind
    new_leads = meetings_stage = contracts_sent = waiting_payment_count = closed_won = 0
    pot_sum = 0
    min_pos = min((s.position for s in stages), default=0)

    for lead in leads:
        stage = stage_map.get(lead.stage_id) if lead.stage_id else None
        kind = _stage_kind(stage) if stage else "generic"
        if kind == "generic" and stage and stage.position == min_pos:
            new_leads += 1
        if kind == "meeting":
            meetings_stage += 1
        if kind == "contract":
            contracts_sent += 1
        if kind == "waiting_payment":
            waiting_payment_count += 1
        if kind == "won":
            closed_won += 1
        if kind not in ("won", "lost"):
            pot_sum += lead.potential_amount or 0

    total = len(leads)
    conversion_pct = round(closed_won / total * 100, 1) if total > 0 else 0.0

    return FunnelStats(
        new_leads=new_leads,
        meetings_stage=meetings_stage,
        contracts_sent=contracts_sent,
        waiting_payment=waiting_payment_count,
        closed_won=closed_won,
        conversion_pct=conversion_pct,
        potential_sum=pot_sum,
    )


@router.get("/funnel", response_model=FunnelResponse)
def get_funnel(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    source_id: Optional[int] = Query(None),
    setter_id: Optional[int] = Query(None),
    closer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stages = db.query(LeadStage).order_by(LeadStage.position).all()

    q = _eager_lead(db).filter(Lead.status == LeadStatus.active)
    if date_from:
        q = q.filter(Lead.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Lead.created_at < datetime.fromisoformat(date_to))
    if source_id:
        q = q.filter(Lead.source_id == source_id)
    if setter_id:
        q = q.filter(Lead.setter_id == setter_id)
    if closer_id:
        q = q.filter(Lead.closer_id == closer_id)

    leads = q.order_by(Lead.created_at.desc()).all()

    lead_ids = [l.id for l in leads]
    deals_raw = (
        db.query(Deal)
        .filter(Deal.lead_id.in_(lead_ids))
        .order_by(Deal.lead_id, Deal.created_at.desc())
        .all()
    ) if lead_ids else []
    deals_by_lead: dict[int, Deal] = {}
    for d in deals_raw:
        if d.lead_id not in deals_by_lead:
            deals_by_lead[d.lead_id] = d

    now = datetime.now(timezone.utc)
    cards: list[FunnelCardOut] = []
    for lead in leads:
        last_change = (
            db.query(LeadStageHistory)
            .filter(LeadStageHistory.lead_id == lead.id, LeadStageHistory.to_stage_id == lead.stage_id)
            .order_by(LeadStageHistory.created_at.desc())
            .first()
        )
        if last_change and last_change.created_at:
            ts = last_change.created_at
            ts = ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts
            days_in_stage = max(0, (now - ts).days)
        else:
            ts = lead.created_at
            ts = ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts
            days_in_stage = max(0, (now - ts).days)

        d = _lead_to_dict(lead)
        d["source"] = lead.source
        d["service"] = lead.service
        d["stage"] = lead.stage
        d["setter"] = lead.setter
        d["closer"] = lead.closer
        d["days_in_stage"] = days_in_stage
        d["active_deal"] = deals_by_lead.get(lead.id)
        cards.append(FunnelCardOut(**d))

    return FunnelResponse(leads=cards, stages=stages)


@router.get("/{lead_id}", response_model=LeadDetailOut)
def get_lead(lead_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    lead = (
        db.query(Lead)
        .options(
            joinedload(Lead.source),
            joinedload(Lead.service),
            joinedload(Lead.stage),
            joinedload(Lead.setter),
            joinedload(Lead.closer),
        )
        .filter(Lead.id == lead_id)
        .first()
    )
    if not lead:
        raise HTTPException(404, "Лид не найден")

    history = (
        db.query(LeadStageHistory)
        .filter(LeadStageHistory.lead_id == lead_id)
        .order_by(LeadStageHistory.created_at)
        .all()
    )
    activities = (
        db.query(LeadActivity)
        .options(joinedload(LeadActivity.responsible))
        .filter(LeadActivity.lead_id == lead_id)
        .filter(LeadActivity.activity_type != "stage_change")
        .order_by(LeadActivity.created_at.desc())
        .all()
    )
    meetings = (
        db.query(Meeting)
        .options(joinedload(Meeting.closer), joinedload(Meeting.setter))
        .filter(Meeting.lead_id == lead_id)
        .order_by(Meeting.meeting_date.desc())
        .all()
    )
    tasks = (
        db.query(Task)
        .options(joinedload(Task.owner))
        .filter(Task.lead_id == lead_id)
        .all()
    )
    files = (
        db.query(LeadFile)
        .options(joinedload(LeadFile.uploader))
        .filter(LeadFile.lead_id == lead_id)
        .order_by(LeadFile.created_at.desc())
        .all()
    )
    timeline = get_lead_timeline(db, lead)

    return LeadDetailOut(
        **{c.key: getattr(lead, c.key) for c in lead.__table__.columns},
        source=lead.source,
        service=lead.service,
        stage=lead.stage,
        setter=lead.setter,
        closer=lead.closer,
        stage_history=history,
        activities=activities,
        meetings=meetings,
        tasks=tasks,
        files=files,
        timeline=timeline,
    )


@router.post("", response_model=LeadOut, status_code=201)
def create_lead(
    body: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Dupe check
    if body.phone and not body.force:
        existing = db.query(Lead).filter(
            Lead.phone == body.phone,
            Lead.status == LeadStatus.active,
        ).first()
        if existing:
            # 409 with existing lead info
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Лид с таким номером уже существует",
                    "existing": {
                        "id": existing.id,
                        "client_name": existing.client_name,
                        "stage_id": existing.stage_id,
                    },
                },
            )

    # Default stage = first stage by position
    stage_id = body.stage_id
    if not stage_id:
        first_stage = db.query(LeadStage).order_by(LeadStage.position).first()
        stage_id = first_stage.id if first_stage else None

    # Default setter = current user (if not admin specifying another)
    setter_id = body.setter_id
    if not setter_id:
        setter_id = current_user.id

    lead = Lead(
        client_name=body.client_name,
        company_name=body.company_name,
        phone=body.phone,
        whatsapp=body.whatsapp,
        instagram=body.instagram,
        email=body.email,
        address=body.address,
        website=body.website,
        industry=body.industry,
        employees_count=body.employees_count,
        source_id=body.source_id,
        service_id=body.service_id,
        stage_id=stage_id,
        setter_id=setter_id,
        closer_id=body.closer_id,
        potential_amount=body.potential_amount,
        comment=body.comment,
        next_action_type=body.next_action_type,
        next_action_at=body.next_action_at,
    )
    db.add(lead)
    db.flush()

    # Initial stage history entry
    if stage_id:
        from app.services.leads import create_lead_activity
        from app.models import LeadStageHistory as LSH
        db.add(LSH(
            lead_id=lead.id,
            from_stage_id=None,
            to_stage_id=stage_id,
            changed_by=current_user.id,
            comment="Лид создан",
        ))

    db.commit()
    db.refresh(lead)
    return _eager_lead(db).filter(Lead.id == lead.id).first()


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    body: LeadUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lead = _load_lead(db, lead_id)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(lead, field, val)
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return _eager_lead(db).filter(Lead.id == lead_id).first()


@router.post("/{lead_id}/archive", response_model=LeadOut)
def archive_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lead = _load_lead(db, lead_id)
    lead.status = LeadStatus.archived
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return _eager_lead(db).filter(Lead.id == lead_id).first()


@router.patch("/{lead_id}/stage", response_model=LeadOut)
def change_stage(
    lead_id: int,
    body: StageChangeIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = _load_lead(db, lead_id)
    stage = db.query(LeadStage).filter(LeadStage.id == body.to_stage_id).first()
    if not stage:
        raise HTTPException(404, "Этап не найден")

    from app.services.leads import _stage_kind
    kind = _stage_kind(stage)
    extra = body.extra_data

    # Validate required fields per stage kind
    if kind == "meeting":
        if not extra.get("meeting_date") and not extra.get("date"):
            raise HTTPException(422, "Для этапа «Встреча» необходимо указать дату встречи")
        if not extra.get("closer_id") and not lead.closer_id:
            raise HTTPException(422, "Для этапа «Встреча» необходимо указать клоузера")
    elif kind == "won":
        if not extra.get("paid_amount") and not extra.get("amount"):
            raise HTTPException(422, "Для этапа «Оплачено» необходимо указать сумму оплаты")
        if not extra.get("payment_date"):
            raise HTTPException(422, "Для этапа «Оплачено» необходимо указать дату оплаты")

    change_lead_stage(db, lead, body.to_stage_id, changed_by=current_user.id, comment=body.comment, extra_data=extra)
    db.commit()
    db.refresh(lead)
    lead_obj = _eager_lead(db).filter(Lead.id == lead_id).first()
    d = _lead_to_dict(lead_obj)
    d["source"] = lead_obj.source
    d["service"] = lead_obj.service
    d["stage"] = lead_obj.stage
    d["setter"] = lead_obj.setter
    d["closer"] = lead_obj.closer
    d["active_deal"] = db.query(Deal).filter(Deal.lead_id == lead_id).order_by(Deal.created_at.desc()).first()
    return LeadOut(**d)


@router.post("/{lead_id}/activities", response_model=LeadActivityOut, status_code=201)
def create_activity(
    lead_id: int,
    body: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = _load_lead(db, lead_id)
    responsible_id = body.responsible_id or current_user.id
    activity = add_activity(
        db, lead,
        activity_type=body.activity_type,
        channel=body.channel,
        description=body.description,
        responsible_id=responsible_id,
    )
    db.commit()
    db.refresh(activity)
    return db.query(LeadActivity).options(joinedload(LeadActivity.responsible)).filter(LeadActivity.id == activity.id).first()


@router.post("/{lead_id}/files", response_model=LeadFileOut, status_code=201)
def add_file(
    lead_id: int,
    body: FileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _load_lead(db, lead_id)
    f = LeadFile(
        lead_id=lead_id,
        name=body.name,
        url=body.url,
        file_type=body.file_type,
        uploaded_by=current_user.id,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return db.query(LeadFile).options(joinedload(LeadFile.uploader)).filter(LeadFile.id == f.id).first()


@router.delete("/{lead_id}/files/{file_id}", status_code=204)
def delete_file(
    lead_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    f = db.query(LeadFile).filter(LeadFile.id == file_id, LeadFile.lead_id == lead_id).first()
    if not f:
        raise HTTPException(404, "Файл не найден")
    db.delete(f)
    db.commit()

