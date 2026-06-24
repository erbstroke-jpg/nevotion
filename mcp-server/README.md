# NevoOcean MCP Server

MCP-сервер для управления задачами NevoOcean через Claude Desktop. Действует от имени пользователя с его правами.

## Установка

```bash
cd mcp-server
pip install -r requirements.txt
```

## Получение API-ключа

1. Войдите в NevoOcean
2. Перейдите в **Профиль** → раздел **API-ключи (для Claude)**
3. Нажмите **Создать ключ**, введите название (например «Мой Claude»)
4. Скопируйте ключ — он показывается **один раз**

## Настройка Claude Desktop

Откройте конфиг Claude Desktop:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Добавьте блок `mcpServers`:

```json
{
  "mcpServers": {
    "nevoocean": {
      "command": "python",
      "args": ["/АБСОЛЮТНЫЙ/ПУТЬ/К/mcp-server/server.py"],
      "env": {
        "NEVOOCEAN_API_URL": "https://ваш-сервер.com",
        "NEVOOCEAN_API_KEY": "nvo_ваш_ключ_здесь"
      }
    }
  }
}
```

Замените `/АБСОЛЮТНЫЙ/ПУТЬ/К/mcp-server/server.py` на реальный путь к файлу.

Перезапустите Claude Desktop — инструменты появятся автоматически.

## Доступные инструменты

| Инструмент | Описание |
|---|---|
| `list_tasks` | Список задач (фильтры: board_id, assignee_id, status) |
| `get_task` | Детали задачи по ID |
| `create_task` | Создать задачу |
| `assign_task` | Назначить исполнителей |
| `update_task_status` | Переместить задачу в колонку |
| `complete_task` | Завершить задачу |
| `list_boards` | Список доступных досок |
| `list_users` | Список сотрудников |
| `list_leads` | Список лидов (только чтение) |
| `get_lead` | Карточка лида (только чтение) |

## Примеры запросов к Claude

- «Покажи мои активные задачи»
- «Создай задачу "Подготовить презентацию" на моей личной доске с приоритетом high»
- «Назначь задачу 42 на Алексея»
- «Покажи все лиды на стадии Переговоры»
- «Завершить задачу 15»

## Безопасность

Claude действует строго в рамках прав владельца ключа — бэкенд автоматически применяет все проверки доступа. Ключ не хранится в БД в открытом виде — только SHA-256 хеш.
