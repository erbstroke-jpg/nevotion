"use client";

import { useCallback, useEffect, useState } from "react";
import { KanbanBoard } from "./KanbanBoard";
import { TaskModal } from "./TaskModal";
import { ColumnModal } from "./ColumnModal";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Board, BoardColumn, Task, UserWithStats } from "@/lib/types";

export function BoardView({ boardId, lockOwnerId }: { boardId: number; lockOwnerId?: number }) {
  const { user, isAdmin } = useApp();
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  // Map of boardId → Board for cross-board tasks (e.g. backend_queue tasks on personal board)
  const [extraBoards, setExtraBoards] = useState<Map<number, Board>>(new Map());

  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultCol, setDefaultCol] = useState<number | null>(null);

  const [colModal, setColModal] = useState(false);
  const [editingCol, setEditingCol] = useState<BoardColumn | null>(null);

  const loadBoard = useCallback(async () => {
    const [b, ts] = await Promise.all([
      api.getBoard(boardId).catch(() => null),
      api.listTasks(boardId).catch(() => [] as Task[]),
    ]);
    if (b) setBoard(b);
    setTasks(ts);

    // Detect cross-board tasks and load their actual boards
    const foreignBoardIds = [...new Set(ts.filter((t) => t.board_id !== boardId).map((t) => t.board_id))];
    if (foreignBoardIds.length > 0) {
      const entries = await Promise.all(
        foreignBoardIds.map((id) => api.getBoard(id).then((fb) => [id, fb] as [number, Board]).catch(() => null))
      );
      const map = new Map<number, Board>();
      for (const e of entries) if (e) map.set(e[0], e[1]);
      setExtraBoards(map);
    } else {
      setExtraBoards(new Map());
    }
  }, [boardId]);

  useEffect(() => {
    loadBoard().finally(() => setLoading(false));
    api.listUsers().then(setUsers).catch(() => {});
  }, [loadBoard]);

  if (loading || !board) return <div style={{ color: "var(--text3)" }}>Загрузка…</div>;

  const sharedBoard = board.kind === "backend_queue" || board.kind === "qcc";
  const canEditColumns = isAdmin || sharedBoard || (board.kind === "personal" && board.owner_id === user?.id) || (board.kind === "founder" && !!user?.is_founder);
  const canAddTask = canEditColumns;

  function openAddTask(colId: number) { setEditingTask(null); setDefaultCol(colId); setTaskModal(true); }
  function openEditTask(t: Task) { setEditingTask(t); setTaskModal(true); }
  function openEditCol(c: BoardColumn) { setEditingCol(c); setColModal(true); }
  function openAddCol() { setEditingCol(null); setColModal(true); }

  return (
    <>
      <KanbanBoard
        board={board}
        tasks={tasks}
        extraBoards={extraBoards}
        canEditColumns={canEditColumns}
        onChange={loadBoard}
        onCardClick={openEditTask}
        onAddTask={canAddTask ? openAddTask : undefined}
        onEditColumn={openEditCol}
        onAddColumn={openAddCol}
      />
      <TaskModal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        onSaved={loadBoard}
        board={board}
        task={editingTask}
        defaultColumnId={defaultCol}
        lockOwnerId={lockOwnerId}
        users={users}
      />
      <ColumnModal
        open={colModal}
        onClose={() => setColModal(false)}
        onSaved={loadBoard}
        board={board}
        column={editingCol}
      />
    </>
  );
}
