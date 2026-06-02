"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { BoardView } from "@/components/BoardView";
import { ColumnsModal } from "./SalesDepartmentView";
import { meetingApi } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Department, UserWithStats, MarketingRecord, ColumnDef, Board } from "@/lib/types";

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

/* ============ MARKETING ============ */
export function MarketingDepartmentView({ dept }: { dept: Department; departments: Department[] }) {
  const { isAdmin, user } = useApp();
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [records, setRecords] = useState<MarketingRecord[]>([]);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [recModal, setRecModal] = useState(false);
  const [editing, setEditing] = useState<MarketingRecord | null>(null);
  const [colModal, setColModal] = useState(false);

  const load = useCallback(() => {
    api.marketingRecords({ date_from: fFrom || undefined, date_to: fTo || undefined }).then(setRecords).catch(() => {});
  }, [fFrom, fTo]);
  useEffect(() => { api.marketingColumns().then(setColumns).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div><div className="page-h1">Отдел маркетинга</div><div className="page-desc">Контент-план и продакшн</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && <button className="btn btn-ghost" onClick={() => setColModal(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>view_column</span> Колонки</button>}
          <button className="btn btn-primary" onClick={() => { setEditing(null); setRecModal(true); }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Запись</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input className="field-input" style={{ width: "auto" }} type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        <span style={{ color: "var(--text3)" }}>—</span>
        <input className="field-input" style={{ width: "auto" }} type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        {(fFrom || fTo) && <button className="btn btn-ghost" onClick={() => { setFFrom(""); setFTo(""); }}>Сбросить</button>}
      </div>

      <div className="card" style={{ overflow: "hidden" }}><div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Дата</th>{columns.map((c) => <th key={c.id}>{c.label}</th>)}{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} onClick={() => { setEditing(r); setRecModal(true); }} style={{ cursor: "pointer" }}>
                <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>{fmtDate(r.record_date)}</td>
                {columns.map((c) => <td key={c.id} style={{ color: "var(--text)" }}>{r.fields[c.key] ?? "—"}</td>)}
                {isAdmin && <td style={{ width: 40 }}><button className="row-act" onClick={async (e) => { e.stopPropagation(); if (confirm("Удалить?")) { await api.deleteMarketingRecord(r.id); load(); } }}><span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span></button></td>}
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={columns.length + 2} style={{ textAlign: "center", color: "var(--text3)", padding: "40px 20px", fontSize: 14 }}>📣 Нет записей. Нажмите «+ Запись» чтобы добавить.</td></tr>}
          </tbody>
        </table>
      </div></div>

      <MarketingRecordModal open={recModal} onClose={() => setRecModal(false)} onSaved={load} record={editing} columns={columns} userId={user?.id} />
      <ColumnsModal open={colModal} onClose={() => setColModal(false)} onSaved={() => api.marketingColumns().then(setColumns)} columns={columns} addFn={api.addMarketingColumn} delFn={api.deleteMarketingColumn} />
      <TableStyles />
    </div>
  );
}

function MarketingRecordModal({ open, onClose, onSaved, record, columns, userId }: any) {
  const [date, setDate] = useState("");
  const [fields, setFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (record) { setDate(record.record_date); setFields(record.fields || {}); }
    else { setDate(new Date().toISOString().slice(0, 10)); setFields({}); }
  }, [open, record]);
  async function save() {
    setSaving(true);
    try {
      const payload: any = { record_date: date, fields, user_id: userId ?? null };
      if (record) await api.updateMarketingRecord(record.id, payload);
      else await api.createMarketingRecord(payload);
      onClose(); onSaved();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={record ? "Запись" : "Новая запись"} width={440}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>Сохранить</button></>}>
      <div className="field"><label className="field-label">Дата</label><input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      {columns.map((c: ColumnDef) => (
        <div className="field" key={c.id}>
          <label className="field-label">{c.label}</label>
          <input className="field-input" value={fields[c.key] ?? ""} onChange={(e) => setFields({ ...fields, [c.key]: e.target.value })} />
        </div>
      ))}
    </Modal>
  );
}

/* ============ FINANCE (iframe) ============ */
export function FinanceDepartmentView({ dept }: { dept: Department; departments: Department[] }) {
  const { isAdmin } = useApp();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(dept.embed_url);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try { await api.updateDepartment(dept.id, { embed_url: url }); setEditing(false); }
    catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div><div className="page-h1">Отдел финансов</div><div className="page-desc">Финансовая таблица (Google Sheets)</div></div>
        {isAdmin && <button className="btn btn-ghost" onClick={() => setEditing(!editing)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span> {editing ? "Отмена" : "Изменить ссылку"}</button>}
      </div>

      {editing && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <label className="field-label">Ссылка на Google Sheets (Publish to web → Embed)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../pubhtml?widget=true" />
            <button className="btn btn-primary" onClick={save} disabled={saving}>Сохранить</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
            В Google Sheets: Файл → Поделиться → Опубликовать в интернете → Встроить, скопируйте URL из src.
          </div>
        </div>
      )}

      {dept.embed_url ? (
        <div className="card" style={{ overflow: "hidden", height: "calc(100vh - 220px)" }}>
          <iframe src={dept.embed_url} style={{ width: "100%", height: "100%", border: "none" }} title="Финансы" />
        </div>
      ) : (
        <EmptyState icon="account_balance" title="Таблица не подключена"
          desc={isAdmin ? "Нажмите «Изменить ссылку» и вставьте URL опубликованной Google-таблицы." : "Финансовая таблица пока не настроена."} />
      )}
      <TableStyles />
    </div>
  );
}

/* ============ ABOUT ============ */
export function AboutDepartmentView({ dept }: { dept: Department; departments: Department[] }) {
  const { isAdmin } = useApp();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(dept.content);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try { await api.updateDepartment(dept.id, { content }); setEditing(false); }
    catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="page-h1">О компании</div>
        {isAdmin && <button className="btn btn-ghost" onClick={() => editing ? save() : setEditing(true)} disabled={saving}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{editing ? "save" : "edit"}</span> {editing ? "Сохранить" : "Редактировать"}
        </button>}
      </div>
      {editing ? (
        <textarea className="field-input" style={{ minHeight: 360, lineHeight: 1.6, resize: "vertical" }}
          value={content} onChange={(e) => setContent(e.target.value)} placeholder="Введите текст о компании…" />
      ) : content ? (
        <div className="card" style={{ padding: 28, fontSize: 15, lineHeight: 1.7, color: "var(--text2)", whiteSpace: "pre-wrap", maxWidth: 800 }}>{content}</div>
      ) : (
        <EmptyState icon="business" title="Раздел пуст" desc={isAdmin ? "Нажмите «Редактировать» чтобы добавить информацию." : "Информация появится позже."} />
      )}
      <TableStyles />
    </div>
  );
}

/* ============ QCC (shared tracker) ============ */
export function QccDepartmentView({ dept }: { dept: Department; departments: Department[] }) {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    api.boardsForDepartment(dept.id).then((bs) => setBoard(bs.find((b) => b.kind === "qcc") ?? null)).catch(() => {});
  }, [dept.id]);
  return (
    <div>
      <div className="page-head"><div className="page-h1">Отдел контроля качества</div>
        <div className="page-desc">Общий трекер · виден и редактируем всеми</div></div>
      {board ? <BoardView boardId={board.id} /> : (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: "60px 20px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, display: "block", marginBottom: 12 }}>fact_check</span>
          Загрузка доски…
        </div>
      )}
      <TableStyles />
    </div>
  );
}

/* ============ HIDDEN (founders' trackers) ============ */
export function HiddenDepartmentView() {
  const router = useRouter();
  const [founders, setFounders] = useState<UserWithStats[]>([]);
  useEffect(() => {
    api.listUsers().then((us) => setFounders(us.filter((u) => u.is_founder))).catch(() => {});
  }, []);
  return (
    <div>
      <div className="page-head"><div className="page-h1">Скрытая часть</div>
        <div className="page-desc">Трекеры основателей · виден только основателям</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {founders.map((u) => (
          <div key={u.id} className="card" style={{ padding: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }} onClick={() => router.push(`/team/${u.id}`)}>
            <Avatar name={u.name} color={u.avatar_color} size={42} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{u.name}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{u.position}</div>
            </div>
            <span className="material-symbols-outlined" style={{ marginLeft: "auto", color: "var(--text3)", fontSize: 20 }}>chevron_right</span>
          </div>
        ))}
      </div>
      <TableStyles />
    </div>
  );
}

/* ============ shared bits ============ */
function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 30, color: "var(--text3)" }}>{icon}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--text3)", marginTop: 6, maxWidth: 380 }}>{desc}</div>
    </div>
  );
}

function TableStyles() {
  return (
    <style jsx global>{`
      .data-table { width: 100%; border-collapse: collapse; }
      .data-table thead { background: var(--bg3); }
      .data-table th { padding: 11px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text3); border-bottom: 1px solid var(--border); white-space: nowrap; }
      .data-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid var(--border); color: var(--text2); }
      .data-table tr:last-child td { border-bottom: none; }
      .data-table tbody tr:hover td { background: var(--bg-hover); }
      .row-act { width: 28px; height: 28px; border: none; background: transparent; color: var(--text3); border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .row-act:hover { background: var(--bg3); color: var(--text); }
    `}</style>
  );
}
