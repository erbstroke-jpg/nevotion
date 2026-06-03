"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import {
  Task, Board, UserWithStats, TAG_COLORS, PRIORITY_OPTIONS,
} from "@/lib/types";

export function TaskModal({
  open, onClose, onSaved, board, task, defaultColumnId, lockOwnerId, users,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  board: Board;
  task: Task | null;
  defaultColumnId?: number | null;
  lockOwnerId?: number;
  users: UserWithStats[];
}) {
  const { isAdmin, user } = useApp();
  const toast = useToast();
  const isBackendQueue = board.kind === "backend_queue";
  const isShared = board.kind === "backend_queue" || board.kind === "qcc";

  const [form, setForm] = useState<any>({
    title: "", tag: "Задача", tag_color: "indigo", priority: "med",
    due_date: "", column_id: null, owner_id: "",
    requester_id: "", assignee_ids: [] as number[], task_type: "",
  });
  const [saving, setSaving] = useState(false);
  const initialFormRef = useRef<string>("");

  const cols = [...board.columns].sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (!open) return;
    let newForm: any;
    if (task) {
      newForm = {
        title: task.title, description: task.description || '', tag: task.tag, tag_color: task.tag_color, priority: task.priority,
        due_date: task.due_date ?? "", column_id: task.column_id,
        owner_id: task.owner_id ? String(task.owner_id) : "",
        requester_id: task.requester_id ? String(task.requester_id) : "",
        assignee_ids: task.assignee_ids ?? [], task_type: task.task_type ?? "",
      };
    } else {
      newForm = {
        title: "", description: "", tag: "Задача", tag_color: "indigo", priority: "med", due_date: "",
        column_id: defaultColumnId ?? (cols[0]?.id ?? null),
        owner_id: lockOwnerId ? String(lockOwnerId) : (isAdmin || isShared ? "" : String(user?.id ?? "")),
        requester_id: isBackendQueue ? String(user?.id ?? "") : "",
        assignee_ids: [], task_type: "",
      };
    }
    setForm(newForm);
    initialFormRef.current = JSON.stringify(newForm);
  }, [open, task, defaultColumnId, lockOwnerId, isAdmin, isShared, isBackendQueue, user]);

  function isDirty() {
    return JSON.stringify(form) !== initialFormRef.current;
  }

  function handleClose() {
    if (isDirty() && !confirm("Внести изменения перед закрытием?")) return;
    onClose();
  }

  function toggleAssignee(id: number) {
    setForm((f: any) => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(id) ? f.assignee_ids.filter((x: number) => x !== id) : [...f.assignee_ids, id],
    }));
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        title: form.title, description: form.description, tag: form.tag, tag_color: form.tag_color, priority: form.priority,
        due_date: form.due_date || null, column_id: form.column_id,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
        task_type: form.task_type,
        requester_id: form.requester_id ? Number(form.requester_id) : null,
        assignee_ids: form.assignee_ids,
      };
      if (task) await api.updateTask(task.id, payload);
      else await api.createTask({ ...payload, board_id: board.id });
      initialFormRef.current = JSON.stringify(form);
      onClose(); onSaved(); toast(task ? "Задача обновлена" : "Задача создана");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function complete() {
    if (!task) return;
    try { await api.completeTask(task.id); onClose(); onSaved(); toast("Задача завершена ✓"); }
    catch (e: any) { alert(e.message); }
  }

  async function remove() {
    if (!task || !confirm("Удалить задачу?")) return;
    try { await api.deleteTask(task.id); onClose(); onSaved(); }
    catch (e: any) { alert(e.message); }
  }

  const ownerLocked = (!isAdmin && !isShared) || !!lockOwnerId;
  const backenders = users.filter((u) => u.position === "Бэкенд" || u.position === "Главный тех лид");

  return (
    <Modal open={open} onClose={handleClose} title={task ? "Задача" : "Новая задача"} width={480}
      footer={
        <>
          {task && <button className="btn btn-ghost" style={{ marginRight: "auto", color: "var(--red)" }} onClick={remove}>Удалить</button>}
          {task && !task.completed_at && <button className="btn btn-ghost" style={{ color: "var(--green)" }} onClick={complete}>✓ Завершить</button>}
          <button className="btn btn-ghost" onClick={handleClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>Сохранить</button>
        </>
      }>
      <div className="field">
        <label className="field-label">Название</label>
        <textarea className="field-input" value={form.title} autoFocus rows={1}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Что нужно сделать?"
          style={{ resize: "vertical", minHeight: 40 }} />
      </div>

      <div className="field">
        <label className="field-label">Описание (необязательно)</label>
        <textarea className="field-input" value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Детали задачи…" rows={2} style={{ resize: "vertical" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Тег</label>
          <input className="field-input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Бот, Фикс, Дизайн…" />
        </div>
        <div className="field">
          <label className="field-label">Цвет тега</label>
          <div style={{ display: "flex", gap: 6, paddingTop: 6 }}>
            {TAG_COLORS.map((c) => (
              <button key={c.value} onClick={() => setForm({ ...form, tag_color: c.value })} title={c.label}
                style={{ width: 24, height: 24, borderRadius: "50%", background: c.fg, cursor: "pointer",
                  border: form.tag_color === c.value ? "2px solid var(--text)" : "2px solid transparent" }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Колонка</label>
          <select className="field-select" value={form.column_id ?? ""} onChange={(e) => setForm({ ...form, column_id: Number(e.target.value) })}>
            {cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Приоритет</label>
          <select className="field-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {isBackendQueue ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label">Запросчик</label>
              <select className="field-select" value={form.requester_id} onChange={(e) => setForm({ ...form, requester_id: e.target.value })}>
                <option value="">— выбрать —</option>
                {users.filter((u) => u.position !== "Руководитель").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Тип задачи</label>
              <input className="field-input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })} placeholder="API, Деплой…" />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Бэкендеры (можно несколько)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {backenders.map((u) => {
                const sel = form.assignee_ids.includes(u.id);
                return (
                  <button key={u.id} onClick={() => toggleAssignee(u.id)} style={{
                    padding: "5px 11px", borderRadius: 16, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                    background: sel ? "var(--primary-dim)" : "var(--bg2)", color: sel ? "var(--primary)" : "var(--text2)",
                  }}>{u.name}</button>
                );
              })}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Срок</label>
            <input className="field-input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Срок</label>
            <input className="field-input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Исполнитель</label>
            <select className="field-select" value={form.owner_id} disabled={ownerLocked} style={{ opacity: ownerLocked ? 0.6 : 1 }}
              onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
              <option value="">— не назначен —</option>
              {users.filter((u) => u.position !== "Руководитель").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {task && (
        <div style={{ background: "var(--bg3)", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
          {task.requester && task.requester.id !== task.owner_id && (
            <div style={{ marginBottom: 4 }}>👤 Назначил: <strong style={{ color: "var(--text2)" }}>{task.requester.name}</strong></div>
          )}
          <div>📅 Создано: {new Date(task.created_at).toLocaleDateString("ru-RU")}</div>
          {task.completed_at && <div style={{ color: "var(--green)", marginTop: 4 }}>✓ Завершено {task.completed_at}</div>}
        </div>
      )}
    </Modal>
  );
}
