"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { User, Department, AVATAR_COLORS } from "@/lib/types";

const COLORS = Object.keys(AVATAR_COLORS);

export function UserModal({ open, onClose, onSaved, user, departments, defaultDeptId }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  user: User | null;
  departments: Department[];
  defaultDeptId?: number;
}) {
  const [form, setForm] = useState<any>({
    name: "", email: "", password: "", position: "Сотрудник",
    role: "staff", is_founder: false, avatar_color: "indigo", department_ids: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    if (user) {
      setForm({
        name: user.name, email: user.email, password: "", position: user.position,
        role: user.role, is_founder: user.is_founder, avatar_color: user.avatar_color,
        department_ids: (user as any).department_ids ?? [],
      });
    } else {
      setForm({
        name: "", email: "", password: "", position: "Сотрудник",
        role: "staff", is_founder: false, avatar_color: "indigo",
        department_ids: defaultDeptId ? [defaultDeptId] : [],
      });
    }
  }, [open, user, defaultDeptId]);

  function toggleDept(id: number) {
    setForm((f: any) => ({
      ...f,
      department_ids: f.department_ids.includes(id) ? f.department_ids.filter((x: number) => x !== id) : [...f.department_ids, id],
    }));
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!user && !form.password) { alert("Укажите пароль для нового сотрудника"); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name, email: form.email, position: form.position,
        role: form.role, is_founder: form.is_founder, avatar_color: form.avatar_color,
        department_ids: form.department_ids,
      };
      if (form.password) payload.password = form.password;
      if (user) await api.updateUser(user.id, payload);
      else await api.createUser(payload);
      onClose(); onSaved(); toast(user ? "Сотрудник обновлён" : "Сотрудник добавлен");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!user || !confirm(`Удалить сотрудника «${user.name}»?`)) return;
    try { await api.deleteUser(user.id); onClose(); onSaved(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <Modal open={open} onClose={onClose} title={user ? "Сотрудник" : "Новый сотрудник"} width={480}
      footer={
        <>
          {user && <button className="btn btn-ghost" style={{ marginRight: "auto", color: "var(--red)" }} onClick={remove}>Удалить</button>}
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()}>Сохранить</button>
        </>
      }>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Имя</label>
          <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label">Должность</label>
          <input className="field-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Промпт-инженер, Бэкенд…" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Email</label>
          <input className="field-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label">{user ? "Новый пароль (если менять)" : "Пароль"}</label>
          <input className="field-input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="field-label">Уровень доступа</label>
          <select className="field-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Сотрудник</option>
            <option value="admin">Администратор</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Цвет аватара</label>
          <div style={{ display: "flex", gap: 6, paddingTop: 6 }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, avatar_color: c })}
                style={{ width: 24, height: 24, borderRadius: "50%", background: AVATAR_COLORS[c].fg, cursor: "pointer",
                  border: form.avatar_color === c ? "2px solid var(--text)" : "2px solid transparent" }} />
            ))}
          </div>
        </div>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text2)" }}>
          <input type="checkbox" checked={form.is_founder} onChange={(e) => setForm({ ...form, is_founder: e.target.checked })} />
          Основатель (доступ к скрытой части)
        </label>
      </div>
      <div className="field">
        <label className="field-label">Отделы</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {departments.filter((d) => !d.admin_only).map((d) => {
            const sel = form.department_ids.includes(d.id);
            return (
              <button key={d.id} onClick={() => toggleDept(d.id)} style={{
                padding: "5px 11px", borderRadius: 16, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                background: sel ? "var(--primary-dim)" : "var(--bg2)", color: sel ? "var(--primary)" : "var(--text2)",
              }}>{d.name}</button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
