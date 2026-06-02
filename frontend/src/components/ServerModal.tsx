"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { Server, UserWithStats, STATUS_OPTIONS } from "@/lib/types";

export function ServerModal({ open, onClose, onSaved, server, users }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  server: Server | null;
  users: UserWithStats[];
}) {
  const [form, setForm] = useState({ company: "", status: "new", owner_id: "", connected_at: "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    if (server) {
      setForm({
        company: server.company, status: server.status,
        owner_id: server.owner_id ? String(server.owner_id) : "",
        connected_at: server.connected_at ?? "",
      });
    } else {
      setForm({ company: "", status: "new", owner_id: "", connected_at: new Date().toISOString().slice(0, 10) });
    }
  }, [open, server]);

  async function save() {
    if (!form.company.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        company: form.company, status: form.status,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
        connected_at: form.connected_at || null,
      };
      if (server) await api.updateServer(server.id, payload);
      else await api.createServer(payload);
      onClose(); onSaved(); toast(server ? "Бот обновлён" : "Бот добавлен");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={server ? "Изменить бота" : "Добавить бота"} width={420}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.company.trim()}>Сохранить</button>
        </>
      }>
      <div className="field">
        <label className="field-label">Компания</label>
        <input className="field-input" value={form.company} autoFocus onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Например, Эл Суши" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Статус</label>
          <select className="field-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Дата подключения</label>
          <input className="field-input" type="date" value={form.connected_at} onChange={(e) => setForm({ ...form, connected_at: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label className="field-label">Промптер</label>
        <select className="field-select" value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
          <option value="">— не назначен —</option>
          {users.filter((u) => u.position === "Промпт-инженер" || u.position === "Тимлид").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
    </Modal>
  );
}
