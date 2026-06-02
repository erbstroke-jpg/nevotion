# NevoDevs Workspace — Деплой на сервер

Полный стек поднимается одной командой через Docker Compose: PostgreSQL + FastAPI + Next.js + nginx.

## Требования на сервере
- Docker и Docker Compose (`docker compose version` должно работать)
- Открытые порты 80 и 443
- (Опционально) домен, направленный на IP сервера

---

## Шаг 1. Загрузить проект на сервер
```bash
# Через scp с локальной машины:
scp nevodevs-workspace.zip user@your-server-ip:~/
# На сервере:
unzip nevodevs-workspace.zip && cd nevodevs
```

## Шаг 2. Настроить .env
```bash
cp .env.example .env
nano .env
```
Заполнить **обязательно**:
```bash
POSTGRES_PASSWORD=<сильный пароль БД>
SECRET_KEY=<результат: openssl rand -hex 32>
FRONTEND_URL=http://<ip-сервера>        # или https://домен после SSL
ENVIRONMENT=production
```
> При `ENVIRONMENT=production` бэкенд не запустится с дефолтными значениями — это защита.

Сгенерировать SECRET_KEY:
```bash
openssl rand -hex 32
```

## Шаг 3. Запустить
```bash
docker compose up -d --build
```
Это:
- Поднимет PostgreSQL (данные в volume `pgdata` — не теряются при перезапуске)
- Применит миграции Alembic
- Заполнит БД начальными данными (идемпотентно — только если пусто)
- Соберёт и запустит фронтенд и бэкенд
- Поднимет nginx на порту 80

Проверить статус:
```bash
docker compose ps
docker compose logs -f backend    # смотреть логи бэкенда
```

## Шаг 4. Проверить
Открыть `http://<ip-сервера>` → вход `beka@nevodevs.kg` / `admin123`

Проверка API: `http://<ip-сервера>/api/health` → `{"status":"ok","version":"2.1.0","env":"production"}`

---

## ⚠️ Важно после первого входа
Смени дефолтные пароли всех сотрудников (admin123/staff123) через интерфейс — у каждого в Профиле, или админ через карточку сотрудника.

---

## SSL (HTTPS) через Let's Encrypt

После того как домен направлен на сервер:

```bash
# 1. Установить certbot на хост
sudo apt install certbot

# 2. Получить сертификат (nginx уже слушает 80 и отдаёт /.well-known)
sudo certbot certonly --webroot -w ./nginx/certbot -d your-domain.com

# 3. Скопировать сертификаты в nginx/certs/
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./nginx/certs/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./nginx/certs/

# 4. В nginx/nginx.conf раскомментировать HTTPS server-блок
#    и редирект с HTTP, заменить server_name на свой домен

# 5. В .env поменять FRONTEND_URL на https://your-domain.com

# 6. Перезапустить
docker compose restart nginx backend
```

---

## Управление

```bash
docker compose down              # остановить (данные сохраняются)
docker compose up -d             # запустить снова
docker compose up -d --build     # пересобрать после обновления кода
docker compose logs -f backend   # логи
docker compose exec db psql -U nevodevs   # консоль БД
```

### Бэкап базы
```bash
docker compose exec db pg_dump -U nevodevs nevodevs > backup_$(date +%F).sql
```

### Восстановление
```bash
cat backup.sql | docker compose exec -T db psql -U nevodevs nevodevs
```

### Обновление кода
```bash
# залить новую версию, затем:
docker compose up -d --build
# миграции применятся автоматически при старте бэкенда
```

---

## Если что-то не работает

**Бэкенд падает при старте:**
```bash
docker compose logs backend
```
Чаще всего — дефолтный SECRET_KEY/пароль при ENVIRONMENT=production. Заполни .env.

**502 Bad Gateway:**
Бэкенд или фронтенд ещё стартуют. Подожди 30-40 сек, проверь `docker compose ps` — все должны быть healthy/running.

**База не заполнилась:**
```bash
docker compose exec backend python -m app.seed
```

**Сбросить БД полностью (УДАЛИТ ВСЕ ДАННЫЕ):**
```bash
docker compose down -v   # -v удаляет volume
docker compose up -d --build
```
