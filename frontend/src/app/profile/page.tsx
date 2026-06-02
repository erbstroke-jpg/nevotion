"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { AVATAR_COLORS } from "@/lib/types";

const COLORS = Object.keys(AVATAR_COLORS);

export default function ProfilePage() {
  const { user, refreshUser } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", position: "", avatar_color: "indigo" });
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name, position: user.position, avatar_color: user.avatar_color });
  }, [user]);

  async function saveProfile() {
    setSaving(true);
    try {
      await api.updateUser(user!.id, { name: form.name, position: form.position, avatar_color: form.avatar_color });
      await refreshUser();
      toast("Профиль сохранён");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function savePassword() {
    if (pwForm.password !== pwForm.confirm) { toast("Пароли не совпадают", "error"); return; }
    if (pwForm.password.length < 6) { toast("Минимум 6 символов", "error"); return; }
    setPwSaving(true);
    try {
      await api.updateUser(user!.id, { password: pwForm.password });
      setPwForm({ password: "", confirm: "" });
      toast("Пароль изменён");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setPwSaving(false); }
  }

  if (!user) return null;

  return (
    <Shell title="Профиль">
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", margin: 0 }}>Мой профиль</h1>
          <p style={{ fontSize: 13, color: "var(--text3)", margin: "6px 0 0" }}>Управление персональными данными и настройками безопасности</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

          {/* LEFT — profile info */}
          <div className="card" style={{ padding: 28 }}>
            {/* Avatar */}
            <div style={{ position: "relative", width: 120, height: 120, marginBottom: 20 }}>
              <div style={{
                width: 120, height: 120, borderRadius: 16,
                background: AVATAR_COLORS[form.avatar_color]?.fg ?? AVATAR_COLORS.indigo.fg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 42, fontWeight: 700, color: "white",
              }}>
                {(form.name || user.name).slice(0, 1).toUpperCase()}
              </div>
              <div style={{
                position: "absolute", bottom: -6, right: -6,
                width: 32, height: 32, borderRadius: "50%",
                background: "var(--bg2)", border: "2px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text2)" }}>photo_camera</span>
              </div>
            </div>

            {/* Name + email + badges */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{user.name}</div>
              <div style={{ fontSize: 13, color: "var(--text3)", margin: "4px 0 10px" }}>{user.email}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {user.role === "admin" && (
                  <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "var(--primary-dim)", color: "var(--primary)", fontWeight: 500 }}>
                    Администратор
                  </span>
                )}
                {user.is_founder && (
                  <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "rgba(249,115,22,0.1)", color: "#ea580c", fontWeight: 500, border: "1px solid rgba(249,115,22,0.2)" }}>
                    Основатель
                  </span>
                )}
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0 0 20px" }} />

            {/* Fields */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text2)", marginBottom: 6 }}>Имя</label>
              <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text2)", marginBottom: 6 }}>Должность</label>
              <input className="field-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0 0 20px" }} />

            {/* Theme / color */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 12 }}>
                Цвет аватара
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, avatar_color: c })} style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: AVATAR_COLORS[c].fg,
                    cursor: "pointer",
                    border: form.avatar_color === c ? "3px solid var(--text)" : "3px solid transparent",
                    outline: form.avatar_color === c ? "2px solid var(--primary)" : "none",
                    outlineOffset: 2,
                  }} />
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}
              style={{ marginTop: 24, width: "100%", justifyContent: "center", padding: "11px" }}>
              {saving ? "Сохранение…" : "Сохранить изменения"}
            </button>
          </div>

          {/* RIGHT — password */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--primary)" }}>lock</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Смена пароля</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text2)", marginBottom: 6 }}>Новый пароль</label>
              <div style={{ position: "relative" }}>
                <input className="field-input" type={showPw ? "text" : "password"}
                  value={pwForm.password} onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })}
                  placeholder="Введите новый пароль" style={{ paddingRight: 44 }} />
                <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{showPw ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text2)", marginBottom: 6 }}>Подтверждение пароля</label>
              <div style={{ position: "relative" }}>
                <input className="field-input" type={showConfirm ? "text" : "password"}
                  value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  placeholder="Повторите новый пароль" style={{ paddingRight: 44 }} />
                <button onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{showConfirm ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0 0 20px" }} />

            <button className="btn btn-primary" onClick={savePassword} disabled={pwSaving || !pwForm.password}
              style={{ width: "100%", justifyContent: "center", padding: "11px" }}>
              {pwSaving ? "Сохранение…" : "Сохранить пароль"}
            </button>
          </div>
        </div>

        {/* Mobile: stack columns */}
        <style jsx>{`
          @media (max-width: 700px) {
            div[style*="grid-template-columns: 1fr 1fr"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </Shell>
  );
}
