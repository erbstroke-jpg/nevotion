"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { Server, UserWithStats, STATUS_OPTIONS, BOT_SUB_STATUSES, BOT_COLORS, BotColor } from "@/lib/types";

const COLOR_OPTIONS: { value: BotColor; label: string }[] = [
  { value: "green",  label: "Всё отлично" },
  { value: "yellow", label: "В разработке" },
  { value: "blue",   label: "Заморожен" },
  { value: "red",    label: "Проблемный" },
];

export function ServerModal({ open, onClose, onSaved, server, users }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  server: Server | null;
  users: UserWithStats[];
}) {
  const [form, setForm] = useState({
    company: "", status: "new", sub_status: "",
    price: "", color: "green" as BotColor,
    bot_comment: "", owner_id: "", connected_at: "", delivered_at: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    if (server) {
      setForm({
        company: server.company,
        status: server.status,
        sub_status: server.sub_status ?? "",
        price: String(server.price ?? 0),
        color: server.color ?? "green",
        bot_comment: server.bot_comment ?? "",
        owner_id: server.owner_id ? String(server.owner_id) : "",
        connected_at: server.connected_at ?? "",
        delivered_at: server.delivered_at ?? "",
        notes: server.notes ?? "",
      });
    } else {
      setForm({
        company: "", status: "new", sub_status: "",
        price: "", color: "green",
        bot_comment: "", owner_id: "",
        connected_at: new Date().toISOString().slice(0, 10), delivered_at: "", notes: "",
      });
    }
  }, [open, server]);

  // Auto-set default price for support bots
  function handleStatusChange(s: string) {
    setForm((f) => ({
      ...f,
      status: s,
      price: s === "support" && !f.price ? "1000" : f.price,
      sub_status: s !== "new" ? "" : f.sub_status,
    }));
  }

  async function save() {
    if (!form.company.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        company: form.company,
        status: form.status,
        sub_status: form.sub_status || null,
        price: form.price ? Number(form.price) : (form.status === "support" ? 1000 : 0),
        color: form.color,
        bot_comment: form.bot_comment,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
        connected_at: form.connected_at || null,
        delivered_at: form.delivered_at || null,
        notes: form.notes,
      };
      if (server) await api.updateServer(server.id, payload);
      else await api.createServer(payload);
      onClose(); onSaved(); toast(server ? "Проект обновлён" : "Проект добавлен");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  const c = BOT_COLORS[form.color as BotColor] ?? BOT_COLORS.green;

  return (
    <Modal open={open} onClose={onClose} title={server ? "Изменить проект" : "Добавить проект"} width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.company.trim()}>Сохранить</button>
        </>
      }>

      <div className="field">
        <label className="field-label">Название проекта / компания</label>
        <input className="field-input" value={form.company} autoFocus
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          placeholder="Например, Эл Суши" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Статус</label>
          <select className="field-select" value={form.status} onChange={(e) => handleStatusChange(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Дата подключения</label>
          <input className="field-input" type="date" value={form.connected_at}
            onChange={(e) => setForm({ ...form, connected_at: e.target.value })} />
        </div>
      </div>

      {form.status === "new" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Подстатус</label>
            <select className="field-select" value={form.sub_status}
              onChange={(e) => setForm({ ...form, sub_status: e.target.value })}>
              <option value="">— не указан —</option>
              {BOT_SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Дата сдачи</label>
            <input className="field-input" type="date" value={form.delivered_at}
              onChange={(e) => setForm({ ...form, delivered_at: e.target.value })}
              placeholder="авто при выборе «Сдан»" />
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Цена (зарплата)</label>
          <input className="field-input" type="number" min="0" step="100"
            value={form.price}
            placeholder={form.status === "support" ? "1000" : "0"}
            onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label">Цвет статуса</label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {COLOR_OPTIONS.map(({ value, label }) => {
              const col = BOT_COLORS[value];
              return (
                <button key={value} title={label}
                  onClick={() => setForm({ ...form, color: value })}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", border: form.color === value
                      ? `3px solid ${col.color}` : "2px solid transparent",
                    background: col.color, cursor: "pointer", outline: form.color === value ? `2px solid ${col.bg}` : "none",
                    transition: "all 0.15s",
                  }} />
              );
            })}
            <span style={{ fontSize: 12, color: "var(--text3)", alignSelf: "center", marginLeft: 4 }}>{c.label}</span>
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Промптер</label>
        <select className="field-select" value={form.owner_id}
          onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
          <option value="">— не назначен —</option>
          {users.filter((u) => u.position === "Промпт-инженер" || u.position === "Тимлид")
            .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="field-label">Комментарий</label>
        <textarea className="field-input" rows={2} style={{ resize: "vertical" }}
          value={form.bot_comment}
          onChange={(e) => setForm({ ...form, bot_comment: e.target.value })}
          placeholder="Описание, действия, заметки..." />
      </div>

      {form.notes !== undefined && (
        <div className="field">
          <label className="field-label">Заметки (внутренние)</label>
          <textarea className="field-input" rows={2} style={{ resize: "vertical" }}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      )}
    </Modal>
  );
}
