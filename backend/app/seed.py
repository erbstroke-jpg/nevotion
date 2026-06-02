"""Seed NevoDevs database. Run: python -m app.seed"""
from datetime import date, timedelta, datetime, timezone

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models import (
    User, Server, Board, BoardColumn, Task, Department, ColumnDef,
    SalesRecord, MarketingRecord, Meeting, MeetingStatus,
    Role, ServerStatus, Priority,
)

DEFAULT_COLS = [("To-do", "#767586", False), ("In progress", "#4648d4", False), ("Done", "#16a34a", True)]
STAFF_PW = "Nevo2026!"


def make_board(db, name, kind, owner_id=None, department_id=None, cols=None):
    b = Board(name=name, kind=kind, owner_id=owner_id, department_id=department_id)
    db.add(b); db.flush()
    for i, (n, c, d) in enumerate(cols or DEFAULT_COLS):
        db.add(BoardColumn(board_id=b.id, name=n, color=c, position=i, is_done=d))
    db.flush()
    return b


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(User).first():
        print("База уже заполнена — пропускаю.")
        db.close(); return

    # ===== Departments =====
    depts = {
        "about":    Department(name="О компании",       slug="about",    icon="business",        kind="about"),
        "sales":    Department(name="Отдел продаж",     slug="sales",    icon="payments",         kind="sales"),
        "marketing":Department(name="Отдел маркетинга", slug="marketing",icon="campaign",         kind="marketing"),
        "finance":  Department(name="Отдел финансов",   slug="finance",  icon="account_balance",  kind="finance"),
        "dev":      Department(name="Разработка",       slug="dev",      icon="code",             kind="dev"),
        "qcc":      Department(name="ОКК",              slug="qcc",      icon="fact_check",       kind="qcc"),
        "hidden":   Department(name="Скрытая часть",    slug="hidden",   icon="lock",             kind="hidden", admin_only=True),
    }
    for d in depts.values():
        db.add(d)
    db.flush()

    # ===== Users =====
    # All start with STAFF_PW. Admins also use STAFF_PW — easier for first-login.
    # last_seen=None for everyone (nobody has logged in yet)
    def U(name, email, position, color, founder=False, admin=False):
        return User(
            name=name, email=email,
            password_hash=hash_password(STAFF_PW),
            role=Role.admin if admin else Role.staff,
            position=position, is_founder=founder,
            avatar_color=color, is_active=True, last_seen=None,
        )

    # Founders (admin=True)
    beka    = U("Бека",     "beka@nevodevs.kg",     "Руководитель",        "indigo",  founder=True, admin=True)
    erbol   = U("Эрбол",    "erbol@nevodevs.kg",    "Тимлид",              "green",   founder=True, admin=True)
    arslan  = U("Арслан",   "arslan@nevodevs.kg",   "Клоузер",             "orange",  founder=True, admin=True)
    abylay  = U("Абылай",   "abylay@nevodevs.kg",   "Руководитель продаж", "yellow",  founder=True, admin=True)  # сеттер
    nazar   = U("Назар",    "nazar@nevodevs.kg",    "Маркетинг",           "red",     founder=True, admin=True)
    timur   = U("Тимур",    "timur@nevodevs.kg",    "Главный тех лид",     "indigo",  founder=True, admin=True)
    adahan  = U("Адахан",   "adahan@nevodevs.kg",   "Финансовый директор", "green",   founder=True, admin=True)
    # Prompters
    azamat  = U("Азамат",   "azamat@nevodevs.kg",   "Промпт-инженер",      "indigo")
    ariet   = U("Ариет",    "ariet@nevodevs.kg",    "Промпт-инженер",      "green")
    abdulla = U("Абдулла",  "abdulla@nevodevs.kg",  "Промпт-инженер",      "orange")
    turat   = U("Туратбек", "turat@nevodevs.kg",    "Промпт-инженер",      "yellow")
    emirlan = U("Эмирлан",  "emirlan@nevodevs.kg",  "Промпт-инженер",      "red")
    # Backenders
    talgat  = U("Талгат",   "talgat@nevodevs.kg",   "Бэкенд",              "indigo")
    bektur  = U("Бектур",   "bektur@nevodevs.kg",   "Бэкенд",              "green")
    miro    = U("Мирослав", "miroslav@nevodevs.kg", "Бэкенд",              "orange")
    # Sales
    rahima  = U("Рахима",   "rahima@nevodevs.kg",   "Сеттер",              "red")
    minai   = U("Минай",    "minai@nevodevs.kg",    "Сеттер",              "yellow")
    marlen  = U("Марлен",   "marlen@nevodevs.kg",   "Клоузер",             "indigo")
    # QCC
    ahmad   = U("Ахмад",    "ahmad@nevodevs.kg",    "Менеджер качества",   "indigo")

    all_users = [beka, erbol, arslan, abylay, nazar, timur, adahan,
                 azamat, ariet, abdulla, turat, emirlan,
                 talgat, bektur, miro, rahima, minai, marlen, ahmad]
    for u in all_users:
        db.add(u)
    db.flush()

    # ===== Department membership =====
    depts["dev"].members      = [beka, erbol, timur, azamat, ariet, abdulla, turat, emirlan, talgat, bektur, miro]
    depts["sales"].members    = [arslan, abylay, rahima, minai, marlen]
    depts["marketing"].members = [nazar]
    depts["finance"].members  = [adahan]
    depts["qcc"].members      = [ahmad]
    db.flush()

    # ===== Servers =====
    servers_data = [
        ("Эл Суши",        ServerStatus.new,     date(2026,1,15),  azamat),
        ("ImaShop",        ServerStatus.support, date(2026,2,3),   ariet),
        ("DAYAR-DOS",      ServerStatus.new,     date(2026,2,20),  ariet),
        ("TOLKUN.KG",      ServerStatus.support, date(2026,3,10),  turat),
        ("Usadba Orehovo", ServerStatus.new,     date(2026,4,1),   abdulla),
        ("BuyStroy",       ServerStatus.support, date(2026,4,14),  emirlan),
        ("PROFI Bishkek",  ServerStatus.new,     date(2026,4,22),  azamat),
        ("Эл Суши 2",      ServerStatus.new,     date(2026,5,5),   turat),
    ]
    for co, st, dt, owner in servers_data:
        db.add(Server(company=co, status=st, connected_at=dt, owner_id=owner.id))
    db.flush()

    # ===== Personal boards =====
    boards = {}
    for u in all_users:
        boards[u.id] = make_board(db, "Личный трекер", "personal", owner_id=u.id)

    backend_board = make_board(db, "Очередь бэкенда", "backend_queue", department_id=depts["dev"].id)
    qcc_board     = make_board(db, "Трекер ОКК",       "qcc",           department_id=depts["qcc"].id)
    db.flush()

    def first_col(board, idx=0):
        cols = sorted(board.columns, key=lambda c: c.position)
        return cols[min(idx, len(cols)-1)].id

    # ===== Sample personal tasks =====
    db.add(Task(title="Настроить промпт — ресторан", tag="Бот", tag_color="indigo", priority=Priority.low,
                due_date=date(2026,6,10), board_id=boards[azamat.id].id, column_id=first_col(boards[azamat.id]), owner_id=azamat.id))
    db.add(Task(title="Починить бота ImaShop", tag="Фикс", tag_color="red", priority=Priority.high,
                due_date=date(2026,6,5), board_id=boards[ariet.id].id, column_id=first_col(boards[ariet.id],1), owner_id=ariet.id))
    db.add(Task(title="TOLKUN.KG — добавить категорию", tag="Бот", tag_color="indigo", priority=Priority.med,
                due_date=date(2026,6,8), board_id=boards[turat.id].id, column_id=first_col(boards[turat.id],1), owner_id=turat.id))

    # ===== Backend queue tasks =====
    db.add(Task(title="Интеграция Poster API для PROFI", tag="Интеграция", tag_color="green", priority=Priority.high,
                board_id=backend_board.id, column_id=first_col(backend_board),
                requester_id=azamat.id, assignee_ids=[talgat.id, bektur.id], task_type="API"))
    db.add(Task(title="Развернуть вебхук для Эл Суши 2", tag="DevOps", tag_color="indigo", priority=Priority.med,
                board_id=backend_board.id, column_id=first_col(backend_board,1),
                requester_id=turat.id, assignee_ids=[miro.id], task_type="Деплой"))

    # ===== QCC task =====
    db.add(Task(title="Проверить диалоги DAYAR-DOS", tag="Проверка", tag_color="indigo", priority=Priority.med,
                board_id=qcc_board.id, column_id=first_col(qcc_board), owner_id=ahmad.id))

    # ===== Sample meetings =====
    from datetime import timedelta as td
    now = datetime.now(timezone.utc)
    db.add(Meeting(closer_id=arslan.id, setter_id=rahima.id,
        meeting_date=now + td(days=1), address="ул. Манаса 45, Бишкек",
        client_name="Алибек Джумалиев", client_phone="+996 700 123456",
        status=MeetingStatus.scheduled))
    db.add(Meeting(closer_id=marlen.id, setter_id=minai.id,
        meeting_date=now + td(days=2), address="пр. Чуй 101, Бишкек",
        client_name="Айгерим Токтосунова", client_phone="+996 555 789012",
        status=MeetingStatus.scheduled))
    db.add(Meeting(closer_id=arslan.id, setter_id=abylay.id,
        meeting_date=now - td(days=1), address="ул. Советская 12",
        client_name="Бакыт Малиев", client_phone="+996 777 345678",
        status=MeetingStatus.closed))
    db.add(Meeting(closer_id=marlen.id, setter_id=rahima.id,
        meeting_date=now - td(days=3), address="ТРЦ Бишкек Парк",
        client_name="Нурзат Асанова", client_phone="+996 500 901234",
        status=MeetingStatus.push))
    db.flush()

    # ===== Sales columns + sample records =====
    sales_cols = [
        ("Касания",         "касания"),
        ("Дозвоны",         "дозвоны"),
        ("Недозвоны",       "недозвоны"),
        ("Назначено встреч","назначено_встреч"),
        ("Проведено встреч","проведено_встреч"),
    ]
    for i, (label, key) in enumerate(sales_cols):
        db.add(ColumnDef(department_id=depts["sales"].id, key=key, label=label, kind="number", position=i))

    today = date(2026,6,2)
    for d_off in range(3):
        rd = today - timedelta(days=d_off)
        db.add(SalesRecord(user_id=rahima.id, record_date=rd,
                           metrics={"касания":60-d_off*5,"дозвоны":35-d_off*3,"недозвоны":25,"назначено_встреч":6-d_off,"проведено_встреч":4-d_off}))
        db.add(SalesRecord(user_id=minai.id, record_date=rd,
                           metrics={"касания":55-d_off*4,"дозвоны":30-d_off*2,"недозвоны":25,"назначено_встреч":5,"проведено_встреч":3}))

    # ===== Marketing columns + sample =====
    mk_cols = [("Идея (креатив)","идея"),("Сценарий","сценарий"),("Монтаж","монтаж"),("Планировка","планировка")]
    for i, (label, key) in enumerate(mk_cols):
        db.add(ColumnDef(department_id=depts["marketing"].id, key=key, label=label, kind="text", position=i))
    db.add(MarketingRecord(user_id=nazar.id, record_date=today,
                           fields={"идея":"Reels про кейс Эл Суши","сценарий":"Готов","монтаж":"В работе","планировка":"Неделя 23"}))

    depts["about"].content = "NevoDevs — команда по разработке AI-чатботов для бизнеса в Бишкеке.\n\nЗаполните этот раздел через редактирование (доступно руководителю)."

    db.commit()
    db.close()
    print("✅ База заполнена.")
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  АККАУНТЫ ДЛЯ КОМАНДЫ")
    print("  Стартовый пароль для всех: Nevo2026!")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    accounts = [
        ("Бека",     "beka@nevodevs.kg",     "Руководитель"),
        ("Эрбол",    "erbol@nevodevs.kg",    "Тимлид"),
        ("Арслан",   "arslan@nevodevs.kg",   "Руководитель продаж"),
        ("Абылай",   "abylay@nevodevs.kg",   "Руководитель продаж"),
        ("Назар",    "nazar@nevodevs.kg",    "Маркетинг"),
        ("Тимур",    "timur@nevodevs.kg",    "Главный тех лид"),
        ("Адахан",   "adahan@nevodevs.kg",   "Финансовый директор"),
        ("Азамат",   "azamat@nevodevs.kg",   "Промпт-инженер"),
        ("Ариет",    "ariet@nevodevs.kg",    "Промпт-инженер"),
        ("Абдулла",  "abdulla@nevodevs.kg",  "Промпт-инженер"),
        ("Туратбек", "turat@nevodevs.kg",    "Промпт-инженер"),
        ("Эмирлан",  "emirlan@nevodevs.kg",  "Промпт-инженер"),
        ("Талгат",   "talgat@nevodevs.kg",   "Бэкенд"),
        ("Бектур",   "bektur@nevodevs.kg",   "Бэкенд"),
        ("Мирослав", "miroslav@nevodevs.kg", "Бэкенд"),
        ("Рахима",   "rahima@nevodevs.kg",   "Сеттер"),
        ("Минай",    "minai@nevodevs.kg",    "Сеттер"),
        ("Марлен",   "marlen@nevodevs.kg",   "Клоузер"),
        ("Ахмад",    "ahmad@nevodevs.kg",    "Менеджер качества"),
    ]
    for name, email, pos in accounts:
        print(f"  {name:<12} {email:<28} {pos}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


if __name__ == "__main__":
    seed()
