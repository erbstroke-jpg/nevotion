"""NevoOcean MCP Server — управление задачами от имени пользователя через API-ключ."""

import os
import json
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

API_URL = os.environ.get("NEVOOCEAN_API_URL", "http://localhost:8000").rstrip("/")
API_KEY = os.environ.get("NEVOOCEAN_API_KEY", "")

app = Server("nevoocean")


def _headers() -> dict[str, str]:
    return {"X-API-Key": API_KEY, "Content-Type": "application/json"}


def _client() -> httpx.Client:
    return httpx.Client(base_url=API_URL, headers=_headers(), timeout=15)


def _call(method: str, path: str, **kwargs) -> Any:
    with _client() as c:
        resp = getattr(c, method)(path, **kwargs)
    if resp.status_code == 403:
        return {"error": f"Нет прав: {resp.text}"}
    if resp.status_code == 404:
        return {"error": "Не найдено"}
    if resp.status_code == 401:
        return {"error": "Недействительный API-ключ. Проверьте NEVOOCEAN_API_KEY."}
    if not resp.is_success:
        return {"error": f"HTTP {resp.status_code}: {resp.text}"}
    if resp.status_code == 204:
        return {"ok": True}
    return resp.json()


def _text(data: Any) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps(data, ensure_ascii=False, indent=2))]


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="list_tasks",
            description="Список задач. Фильтры: board_id, assignee_id, status (active/overdue/done).",
            inputSchema={
                "type": "object",
                "properties": {
                    "board_id": {"type": "integer", "description": "ID доски"},
                    "assignee_id": {"type": "integer", "description": "ID исполнителя"},
                    "status": {"type": "string", "enum": ["active", "overdue", "done"], "description": "Фильтр статуса"},
                },
            },
        ),
        Tool(
            name="get_task",
            description="Детали задачи по ID.",
            inputSchema={
                "type": "object",
                "properties": {"task_id": {"type": "integer"}},
                "required": ["task_id"],
            },
        ),
        Tool(
            name="create_task",
            description="Создать задачу на доске.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "board_id": {"type": "integer"},
                    "description": {"type": "string"},
                    "column_id": {"type": "integer"},
                    "assignee_ids": {"type": "array", "items": {"type": "integer"}},
                    "priority": {"type": "string", "enum": ["low", "med", "high"]},
                    "due_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "tag": {"type": "string"},
                },
                "required": ["title", "board_id"],
            },
        ),
        Tool(
            name="assign_task",
            description="Назначить/переназначить исполнителей задачи.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer"},
                    "assignee_ids": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["task_id", "assignee_ids"],
            },
        ),
        Tool(
            name="update_task_status",
            description="Переместить задачу в другую колонку.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer"},
                    "column_id": {"type": "integer"},
                    "position": {"type": "integer", "default": 0},
                },
                "required": ["task_id", "column_id"],
            },
        ),
        Tool(
            name="complete_task",
            description="Завершить задачу (переместить в колонку Done).",
            inputSchema={
                "type": "object",
                "properties": {"task_id": {"type": "integer"}},
                "required": ["task_id"],
            },
        ),
        Tool(
            name="list_boards",
            description="Список досок, доступных текущему пользователю.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="list_users",
            description="Список сотрудников (имя, позиция, id) для назначения задач.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="list_leads",
            description="Список лидов. Фильтры: status (active/archived), stage_id, setter_id, closer_id.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["active", "archived"]},
                    "stage_id": {"type": "integer"},
                    "setter_id": {"type": "integer"},
                    "closer_id": {"type": "integer"},
                    "limit": {"type": "integer", "default": 50},
                    "offset": {"type": "integer", "default": 0},
                },
            },
        ),
        Tool(
            name="get_lead",
            description="Карточка лида по ID.",
            inputSchema={
                "type": "object",
                "properties": {"lead_id": {"type": "integer"}},
                "required": ["lead_id"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "list_tasks":
        params = {}
        if "board_id" in arguments:
            params["board_id"] = arguments["board_id"]
        if "assignee_id" in arguments:
            params["assignee_id"] = arguments["assignee_id"]
        data = _call("get", "/api/tasks", params=params)
        # client-side status filter
        status_filter = arguments.get("status")
        if isinstance(data, list) and status_filter:
            from datetime import date
            today = date.today().isoformat()
            if status_filter == "done":
                data = [t for t in data if t.get("completed_at")]
            elif status_filter == "active":
                data = [t for t in data if not t.get("completed_at") and (not t.get("due_date") or t["due_date"] >= today)]
            elif status_filter == "overdue":
                data = [t for t in data if not t.get("completed_at") and t.get("due_date") and t["due_date"] < today]
        return _text(data)

    elif name == "get_task":
        task_id = arguments["task_id"]
        # fetch task from list (no single-task endpoint in existing API, so filter)
        data = _call("get", "/api/tasks", params={})
        if isinstance(data, list):
            task = next((t for t in data if t["id"] == task_id), None)
            return _text(task or {"error": "Задача не найдена"})
        return _text(data)

    elif name == "create_task":
        body = {k: v for k, v in arguments.items()}
        data = _call("post", "/api/tasks", json=body)
        return _text(data)

    elif name == "assign_task":
        task_id = arguments["task_id"]
        data = _call("patch", f"/api/tasks/{task_id}", json={"assignee_ids": arguments["assignee_ids"]})
        return _text(data)

    elif name == "update_task_status":
        task_id = arguments["task_id"]
        body = {
            "column_id": arguments["column_id"],
            "position": arguments.get("position", 0),
        }
        data = _call("patch", f"/api/tasks/{task_id}/move", json=body)
        return _text(data)

    elif name == "complete_task":
        task_id = arguments["task_id"]
        data = _call("patch", f"/api/tasks/{task_id}/complete")
        return _text(data)

    elif name == "list_boards":
        data = _call("get", "/api/boards")
        return _text(data)

    elif name == "list_users":
        data = _call("get", "/api/users")
        if isinstance(data, list):
            data = [{"id": u["id"], "name": u["name"], "position": u.get("position", ""), "is_active": u.get("is_active", True)} for u in data]
        return _text(data)

    elif name == "list_leads":
        params = {}
        for key in ("status", "stage_id", "setter_id", "closer_id", "limit", "offset"):
            if key in arguments:
                params[key] = arguments[key]
        data = _call("get", "/api/leads", params=params)
        return _text(data)

    elif name == "get_lead":
        lead_id = arguments["lead_id"]
        data = _call("get", f"/api/leads/{lead_id}")
        return _text(data)

    else:
        return _text({"error": f"Неизвестный инструмент: {name}"})


async def main():
    if not API_KEY:
        import sys
        print("ОШИБКА: NEVOOCEAN_API_KEY не задан", file=sys.stderr)
        sys.exit(1)
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
