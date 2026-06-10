import enum
from datetime import datetime, date

from sqlalchemy import (
    String, Integer, Boolean, ForeignKey, Date, DateTime, Enum, func, Text, JSON, Table, Column
)
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Role(str, enum.Enum):
    admin = "admin"
    staff = "staff"


class ServerStatus(str, enum.Enum):
    new = "new"          # Новый бот
    support = "support"  # Тех поддержка


class Priority(str, enum.Enum):
    low = "low"
    med = "med"
    high = "high"


# Many-to-many: users <-> departments
user_departments = Table(
    "user_departments",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("department_id", ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.staff, nullable=False)
    position: Mapped[str] = mapped_column(String(80), default="Сотрудник")
    is_founder: Mapped[bool] = mapped_column(Boolean, default=False)  # доступ к скрытой части
    avatar_color: Mapped[str] = mapped_column(String(20), default="indigo")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # False = archived
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    servers: Mapped[list["Server"]] = relationship(back_populates="owner")
    tasks: Mapped[list["Task"]] = relationship(back_populates="owner", foreign_keys="Task.owner_id")
    departments: Mapped[list["Department"]] = relationship(secondary=user_departments, back_populates="members")


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    icon: Mapped[str] = mapped_column(String(40), default="folder")
    admin_only: Mapped[bool] = mapped_column(Boolean, default=False)
    kind: Mapped[str] = mapped_column(String(40), default="generic")  # generic | dev | sales | marketing | qcc | finance | about | hidden
    content: Mapped[str] = mapped_column(Text, default="")        # for "about" page
    embed_url: Mapped[str] = mapped_column(String(500), default="")  # for finance iframe

    members: Mapped[list["User"]] = relationship(secondary=user_departments, back_populates="departments")


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[ServerStatus] = mapped_column(Enum(ServerStatus), default=ServerStatus.new)
    connected_at: Mapped[date] = mapped_column(Date, default=date.today)
    notes: Mapped[str] = mapped_column(String(500), default="")
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship(back_populates="servers")


class Board(Base):
    """A kanban board. Each user has a personal board; departments can have shared boards
    (backend queue, QCC tracker). Columns are dynamic and editable."""
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Доска")
    kind: Mapped[str] = mapped_column(String(40), default="personal")  # personal | backend_queue | qcc | founder
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)

    columns: Mapped[list["BoardColumn"]] = relationship(
        back_populates="board", cascade="all, delete-orphan", order_by="BoardColumn.position"
    )
    tasks: Mapped[list["Task"]] = relationship(back_populates="board", cascade="all, delete-orphan")


class BoardColumn(Base):
    __tablename__ = "board_columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#767586")
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)  # столбец "Готово" — ставит completed_at

    board: Mapped["Board"] = relationship(back_populates="columns")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    tag: Mapped[str] = mapped_column(String(60), default="Задача")  # free-text editable tag
    tag_color: Mapped[str] = mapped_column(String(20), default="indigo")
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.med)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[date | None] = mapped_column(Date, nullable=True)  # автозаполнение при "Готово"
    position: Mapped[int] = mapped_column(Integer, default=0)

    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))
    column_id: Mapped[int | None] = mapped_column(ForeignKey("board_columns.id", ondelete="SET NULL"), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # backend queue specific
    requester_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assignee_ids: Mapped[list | None] = mapped_column(JSON, default=list)  # multiple backend assignees
    task_type: Mapped[str] = mapped_column(String(80), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    board: Mapped["Board"] = relationship(back_populates="tasks")
    column: Mapped["BoardColumn"] = relationship()
    owner: Mapped["User"] = relationship(back_populates="tasks", foreign_keys=[owner_id])
    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])


class SalesRecord(Base):
    """Дневник отдела продаж: одна запись = сотрудник + дата + метрики."""
    __tablename__ = "sales_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    record_date: Mapped[date] = mapped_column(Date, default=date.today)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)  # {"касания": 50, "дозвоны": 30, ...}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()


class MarketingRecord(Base):
    """Маркетинг: недельная планировка по колонкам."""
    __tablename__ = "marketing_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    record_date: Mapped[date] = mapped_column(Date, default=date.today)
    fields: Mapped[dict] = mapped_column(JSON, default=dict)  # {"идея": "...", "сценарий": "...", ...}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()


class ColumnDef(Base):
    """Определения колонок для табличных отделов (продажи, маркетинг) — редактируемые."""
    __tablename__ = "column_defs"

    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(80), nullable=False)   # internal key
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default="number")  # number | text
    position: Mapped[int] = mapped_column(Integer, default=0)


class BugStatus(str, enum.Enum):
    new         = "new"
    in_progress = "in_progress"
    resolved    = "resolved"


class BugReport(Base):
    __tablename__ = "bug_reports"

    id:          Mapped[int]           = mapped_column(primary_key=True)
    reporter_id: Mapped[int | None]    = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title:       Mapped[str]           = mapped_column(String(300), nullable=False)
    description: Mapped[str]           = mapped_column(Text, default="")
    status:      Mapped[BugStatus]     = mapped_column(Enum(BugStatus), default=BugStatus.new)
    priority:    Mapped[str]           = mapped_column(String(20), default="medium")  # low | medium | high | critical
    created_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())

    reporter: Mapped["User"] = relationship()


class MeetingStatus(str, enum.Enum):
    scheduled  = "scheduled"   # запланирована
    closed     = "closed"      # Закрыт
    minus      = "minus"       # Минус
    push       = "push"        # Дожим
    rescheduled = "rescheduled" # Перенёс


class Meeting(Base):
    """Встреча — назначается сеттером, проводится клоузером."""
    __tablename__ = "meetings"

    id:            Mapped[int]            = mapped_column(primary_key=True)
    closer_id:     Mapped[int | None]     = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    setter_id:     Mapped[int | None]     = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    meeting_date:  Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False)
    address:       Mapped[str]            = mapped_column(String(300), default="")
    client_name:   Mapped[str]            = mapped_column(String(200), nullable=False)
    client_phone:  Mapped[str]            = mapped_column(String(50), default="")
    status:        Mapped[MeetingStatus]  = mapped_column(Enum(MeetingStatus), default=MeetingStatus.scheduled)
    notes:         Mapped[str]            = mapped_column(Text, default="")
    parent_id:     Mapped[int | None]     = mapped_column(ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True)
    created_at:    Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now())

    closer:    Mapped["User"]         = relationship(foreign_keys=[closer_id])
    setter:    Mapped["User"]         = relationship(foreign_keys=[setter_id])
    sub_meetings: Mapped[list["Meeting"]] = relationship(
        foreign_keys=[parent_id], back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped["Meeting | None"]  = relationship(
        foreign_keys=[parent_id], back_populates="sub_meetings", remote_side="Meeting.id"
    )
