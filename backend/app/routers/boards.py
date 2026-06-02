from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import (
    Board, BoardColumn, Task, User, Role, Department,
)
from app.schemas import (
    BoardOut, BoardColumnOut, BoardColumnCreate, BoardColumnUpdate,
    TaskOut, TaskCreate, TaskUpdate, TaskMove,
)

router = APIRouter(prefix="/api/boards", tags=["boards"])


DEFAULT_COLUMNS = [
    ("To-do", "#767586", False),
    ("In progress", "#4648d4", False),
    ("Done", "#16a34a", True),
]


def ensure_personal_board(db: Session, user_id: int) -> Board:
    board = db.query(Board).filter(Board.kind == "personal", Board.owner_id == user_id).first()
    if board:
        return board
    board = Board(name="Личный трекер", kind="personal", owner_id=user_id)
    db.add(board)
    db.flush()
    for i, (name, color, is_done) in enumerate(DEFAULT_COLUMNS):
        db.add(BoardColumn(board_id=board.id, name=name, color=color, position=i, is_done=is_done))
    db.commit()
    db.refresh(board)
    return board


def _can_edit_board(user: User, board: Board) -> bool:
    """Personal board: owner or admin. Shared boards (backend_queue, qcc, founder): broader rules."""
    if user.role == Role.admin:
        return True
    if board.kind == "personal":
        return board.owner_id == user.id
    if board.kind in ("backend_queue", "qcc"):
        return True  # visible & editable for all (per spec)
    if board.kind == "founder":
        return user.is_founder
    return False


def _can_view_board(user: User, board: Board) -> bool:
    if board.kind == "founder":
        return user.is_founder
    return True


# ---------- Boards ----------
@router.get("/personal/{user_id}", response_model=BoardOut)
def get_personal_board(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ensure_personal_board(db, user_id)


@router.get("/by-department/{dept_id}", response_model=list[BoardOut])
def boards_for_department(dept_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    boards = db.query(Board).filter(Board.department_id == dept_id).all()
    return [b for b in boards if _can_view_board(user, b)]


@router.get("/{board_id}", response_model=BoardOut)
def get_board(board_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    board = db.get(Board, board_id)
    if not board:
        raise HTTPException(404, "Доска не найдена")
    if not _can_view_board(user, board):
        raise HTTPException(403, "Нет доступа")
    return board


# ---------- Columns ----------
@router.post("/{board_id}/columns", response_model=BoardColumnOut, status_code=201)
def add_column(board_id: int, payload: BoardColumnCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    board = db.get(Board, board_id)
    if not board:
        raise HTTPException(404, "Доска не найдена")
    if not _can_edit_board(user, board):
        raise HTTPException(403, "Нет прав на изменение доски")
    maxpos = max([c.position for c in board.columns], default=-1)
    col = BoardColumn(board_id=board_id, name=payload.name, color=payload.color,
                      position=maxpos + 1, is_done=payload.is_done)
    db.add(col)
    db.commit()
    db.refresh(col)
    return col


@router.patch("/columns/{column_id}", response_model=BoardColumnOut)
def update_column(column_id: int, payload: BoardColumnUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    col = db.get(BoardColumn, column_id)
    if not col:
        raise HTTPException(404, "Колонка не найдена")
    board = db.get(Board, col.board_id)
    if not _can_edit_board(user, board):
        raise HTTPException(403, "Нет прав")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(col, f, v)
    db.commit()
    db.refresh(col)
    return col


@router.delete("/columns/{column_id}", status_code=204)
def delete_column(column_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    col = db.get(BoardColumn, column_id)
    if not col:
        raise HTTPException(404, "Колонка не найдена")
    board = db.get(Board, col.board_id)
    if not _can_edit_board(user, board):
        raise HTTPException(403, "Нет прав")
    # move tasks in this column to the first remaining column
    remaining = [c for c in board.columns if c.id != column_id]
    if not remaining:
        raise HTTPException(400, "Нельзя удалить единственную колонку")
    target = sorted(remaining, key=lambda c: c.position)[0]
    db.query(Task).filter(Task.column_id == column_id).update({Task.column_id: target.id})
    db.delete(col)
    db.commit()
