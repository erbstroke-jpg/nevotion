"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { api } from "@/lib/api";
import { Board, BoardColumn } from "@/lib/types";

const COLOR_PRESETS = ["#767586", "#4648d4", "#16a34a", "#ca8a04", "#b55d00", "#ba1a1a", "#0891b2"];

export function ColumnModal({ open, onClose, onSaved, board, column }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  board: Board;
  column: BoardColumn | null;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#767586");
  const [isDone, setIsDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (column) { setName(column.name); setColor(column.color); setIsDone(column.is_done); }
    else { setName(""); setColor("#767586"); setIsDone(false); }
  }, [open, column]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (column) await api.updateColumn(column.id, { name, color, is_done: isDone });
      else await api.addColumn(board.id, { name, color, is_done: isDone });
      onClose(); onSaved();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!column) return;
    if (board.columns.length <= 1) { alert("Нельзя удалить единственную колонку"); return; }
    if (!confirm(`Удалить колонку «${column.name}»? Задачи переедут в первую колонку.`)) return;
    try { await api.deleteColumn(column.id); onClose(); onSaved(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <Modal open={open} onClose={onClose} title={column ? "Колонка" : "Новая колонка"} width={380}
      footer={
        <>
          {column && <button className="btn btn-ghost" style={{ marginRight: "auto", color: "var(--red)" }} onClick={remove}>Удалить</button>}
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>Сохранить</button>
        </>
      }>
      <div className="field">
        <label className="field-label">Название</label>
        <input className="field-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Например, Ревью" />
      </div>
      <div className="field">
        <label className="field-label">Цвет</label>
        <div style={{ display: "flex", gap: 8 }}>
          {COLOR_PRESETS.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
              border: color === c ? "2px solid var(--text)" : "2px solid transparent",
            }} />
          ))}
        </div>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text2)" }}>
          <input type="checkbox" checked={isDone} onChange={(e) => setIsDone(e.target.checked)} />
          Колонка «Готово» (автоматически ставит дату завершения)
        </label>
      </div>
    </Modal>
  );
}
