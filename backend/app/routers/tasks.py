from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Task, Board, BoardColumn, User, Role
from app.schemas import TaskOut, TaskCreate, TaskUpdate, TaskMove
from app.routers.boards import _can_edit_board, _can_view_board


def _validate_column(db: Session, column_id: int | None, board_id: int) -> None:
    """Ensure the column belongs to the board, preventing cross-board IDOR."""
    if column_id is None:
        return
    col = db.get(BoardColumn, column_id)
    if not col or col.board_id != board_id:
        raise HTTPException(400, "Колонка не принадлежит этой доске")

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _load(db: Session, task_id: int) -> Task:
    task = db.query(Task).options(
        joinedload(Task.owner), joinedload(Task.requester), joinedload(Task.column)
    ).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Задача не найдена")
    return task


def _can_modify(db: Session, user: User, task: Task) -> bool:
    board = db.get(Board, task.board_id)
    if board and board.kind in ("backend_queue", "qcc"):
        return True  # shared editable
    if user.role == Role.admin:
        return True
    return task.owner_id == user.id


def _apply_done_logic(db: Session, task: Task):
    """If task's column is a done-column, set completed_at; else clear it."""
    if task.column_id:
        col = db.get(BoardColumn, task.column_id)
        if col and col.is_done:
            if not task.completed_at:
                task.completed_at = date.today()
        else:
            task.completed_at = None


@router.get("", response_model=list[TaskOut])
def list_tasks(
    board_id: Optional[int] = Query(None),
    assignee_id: Optional[int] = Query(None),  # filter by user in assignee_ids
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Task).options(joinedload(Task.owner), joinedload(Task.requester))
    if board_id:
        board = db.get(Board, board_id)
        if not board:
            raise HTTPException(404, "Доска не найдена")
        if not _can_view_board(user, board, db):
            raise HTTPException(403, "Нет доступа")
        q = q.filter(Task.board_id == board_id)

    if assignee_id:
        # JSON contains filter — works for PostgreSQL and SQLite
        from sqlalchemy import cast, String
        q = q.filter(Task.assignee_ids.cast(String).contains(str(assignee_id)))

    return q.order_by(Task.position, Task.id).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    board = db.get(Board, payload.board_id)
    if not board:
        raise HTTPException(404, "Доска не найдена")
    if not _can_edit_board(user, board, db):
        raise HTTPException(403, "Нет прав на эту доску")

    data = payload.model_dump()
    _validate_column(db, data.get("column_id"), board.id)
    # personal boards: staff can only create their own tasks
    if board.kind == "personal" and user.role != Role.admin:
        data["owner_id"] = board.owner_id

    # default column = first column of board
    if not data.get("column_id"):
        first = sorted(board.columns, key=lambda c: c.position)[0] if board.columns else None
        data["column_id"] = first.id if first else None

    # Auto-set requester: if a different user is creating on someone else's personal board
    if board.kind == "personal" and board.owner_id != user.id and not data.get("requester_id"):
        data["requester_id"] = user.id

    task = Task(**data)
    _apply_done_logic(db, task)
    db.add(task)
    db.commit()
    return _load(db, task.id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load(db, task_id)
    if not _can_modify(db, user, task):
        raise HTTPException(403, "Вы можете изменять только свои задачи")
    updates = payload.model_dump(exclude_unset=True)
    if "column_id" in updates:
        _validate_column(db, updates["column_id"], task.board_id)
    for f, v in updates.items():
        setattr(task, f, v)
    _apply_done_logic(db, task)
    db.commit()
    return _load(db, task_id)


@router.patch("/{task_id}/move", response_model=TaskOut)
def move_task(task_id: int, payload: TaskMove, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load(db, task_id)
    if not _can_modify(db, user, task):
        raise HTTPException(403, "Вы можете перемещать только свои задачи")
    _validate_column(db, payload.column_id, task.board_id)

    old_col = task.column_id
    new_col = payload.column_id

    if old_col != new_col:
        # Shift tasks in old column: close the gap
        if old_col:
            db.query(Task).filter(
                Task.column_id == old_col,
                Task.position > task.position,
                Task.id != task_id,
            ).update({Task.position: Task.position - 1})

        # Shift tasks in new column: open a slot at target position
        db.query(Task).filter(
            Task.column_id == new_col,
            Task.position >= payload.position,
            Task.id != task_id,
        ).update({Task.position: Task.position + 1})
    else:
        # Same column reorder
        if task.position < payload.position:
            db.query(Task).filter(
                Task.column_id == new_col,
                Task.position > task.position,
                Task.position <= payload.position,
                Task.id != task_id,
            ).update({Task.position: Task.position - 1})
        else:
            db.query(Task).filter(
                Task.column_id == new_col,
                Task.position >= payload.position,
                Task.position < task.position,
                Task.id != task_id,
            ).update({Task.position: Task.position + 1})

    task.column_id = new_col
    task.position = payload.position
    _apply_done_logic(db, task)
    db.commit()
    return _load(db, task_id)


@router.patch("/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Кнопка 'Завершить' — двигает в первую done-колонку и ставит дату завершения."""
    task = _load(db, task_id)
    if not _can_modify(db, user, task):
        raise HTTPException(403, "Нет прав")
    board = db.get(Board, task.board_id)
    done_col = next((c for c in sorted(board.columns, key=lambda c: c.position) if c.is_done), None)
    if done_col:
        task.column_id = done_col.id
    task.completed_at = date.today()
    db.commit()
    return _load(db, task_id)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load(db, task_id)
    if not _can_modify(db, user, task):
        raise HTTPException(403, "Нет прав")
    db.delete(task)
    db.commit()
