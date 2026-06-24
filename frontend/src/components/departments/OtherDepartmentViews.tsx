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
import { Department, UserWithStats, MarketingRecord, ColumnDef, Board, AdExpense, SourceMetric, MarketingTotals, LeadSource } from "@/lib/types";

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

/* ============ MARKETING ============ */
export function MarketingDepartmentView({ dept }: { dept: Department; departments: Department[] }) {
  const [tab, setTab] = useState<"content" | "ads" | "metrics">("content");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div><div className="page-h1">Отдел маркетинга</div><div className="page-desc">Контент-план, рекламные расходы, метрики</div></div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {([["content", "Контент-план"], ["ads", "Рекламные расходы"], ["metrics", "Метрики"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "none", background: "transparent", cursor: "pointer",
            color: tab === key ? "var(--primary)" : "var(--text3)",
            borderBottom: tab === key ? "2px solid var(--primary)" : "2px solid transparent",
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>
      {tab === "content" && <ContentPlanTab dept={dept} />}
      {tab === "ads" && <AdExpensesTab />}
      {tab === "metrics" && <MetricsTab />}
      <TableStyles />
    </div>
  );
}

function ContentPlanTab({ dept }: { dept: Department }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="field-input" style={{ width: "auto" }} type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          <span style={{ color: "var(--text3)" }}>—</span>
          <input className="field-input" style={{ width: "auto" }} type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          {(fFrom || fTo) && <button className="btn btn-ghost" onClick={() => { setFFrom(""); setFTo(""); }}>Сбросить</button>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && <button className="btn btn-ghost" onClick={() => setColModal(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>view_column</span> Колонки</button>}
          <button className="btn btn-primary" onClick={() => { setEditing(null); setRecModal(true); }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Запись</button>
        </div>
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
            {records.length === 0 && <tr><td colSpan={columns.length + 2} style={{ textAlign: "center", color: "var(--text3)", padding: "40px 20px", fontSize: 14 }}>Нет записей. Нажмите «+ Запись» чтобы добавить.</td></tr>}
          </tbody>
        </table>
      </div></div>
      <MarketingRecordModal open={recModal} onClose={() => setRecModal(false)} onSaved={load} record={editing} columns={columns} userId={user?.id} />
      <ColumnsModal open={colModal} onClose={() => setColModal(false)} onSaved={() => api.marketingColumns().then(setColumns)} columns={columns} addFn={api.addMarketingColumn} delFn={api.deleteMarketingColumn} />
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

function AdExpensesTab() {
  const { isAdmin, user } = useApp();
  const [items, setItems] = useState<AdExpense[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [fSource, setFSource] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [skip, setSkip] = useState(0);
  const LIMIT = 30;
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AdExpense | null>(null);

  const canManage = isAdmin || (user?.position ?? "").toLowerCase().includes("маркетинг");

  const load = useCallback(() => {
    api.adExpenses({
      source_id: fSource ? Number(fSource) : undefined,
      date_from: fFrom || undefined,
      date_to: fTo || undefined,
      skip,
      limit: LIMIT,
    }).then((r) => { setItems(r.items); setTotal(r.total); }).catch(() => {});
  }, [fSource, fFrom, fTo, skip]);

  useEffect(() => {
    import("@/lib/api").then(({ settingsApi }) => settingsApi.listSources().then(setSources).catch(() => {}));
  }, []);
  useEffect(() => { load(); }, [load]);

  function fmt(n: number) { return n.toLocaleString("ru-RU") + " сом"; }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="field-input" style={{ width: "auto" }} value={fSource} onChange={(e) => { setFSource(e.target.value); setSkip(0); }}>
            <option value="">Все источники</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="field-input" style={{ width: "auto" }} type="date" value={fFrom} onChange={(e) => { setFFrom(e.target.value); setSkip(0); }} />
          <span style={{ color: "var(--text3)" }}>—</span>
          <input className="field-input" style={{ width: "auto" }} type="date" value={fTo} onChange={(e) => { setFTo(e.target.value); setSkip(0); }} />
          {(fSource || fFrom || fTo) && <button className="btn btn-ghost" onClick={() => { setFSource(""); setFFrom(""); setFTo(""); setSkip(0); }}>Сбросить</button>}
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(true); }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Добавить расход</button>}
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 12 }}><div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Дата</th><th>Источник</th><th>Рекл. кабинет</th><th>Кампания</th><th>Расход</th><th>Ответственный</th><th>Комментарий</th>{canManage && <th></th>}</tr></thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>{fmtDate(e.date)}</td>
                <td>{e.source?.name ?? "—"}</td>
                <td>{e.ad_account || "—"}</td>
                <td>{e.campaign_name || "—"}</td>
                <td style={{ fontWeight: 600 }}>{fmt(e.amount)}</td>
                <td>{e.responsible?.name ?? "—"}</td>
                <td style={{ color: "var(--text3)" }}>{e.comment || "—"}</td>
                {canManage && (
                  <td style={{ width: 70 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="row-act" onClick={() => { setEditing(e); setModal(true); }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span></button>
                      <button className="row-act" onClick={async () => { if (confirm("Удалить?")) { await api.deleteAdExpense(e.id); load(); } }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text3)", padding: "40px 20px", fontSize: 14 }}>Нет расходов за выбранный период.</td></tr>}
          </tbody>
        </table>
      </div></div>

      {total > LIMIT && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - LIMIT))}>← Назад</button>
          <span style={{ fontSize: 13, color: "var(--text3)" }}>{skip + 1}–{Math.min(skip + LIMIT, total)} из {total}</span>
          <button className="btn btn-ghost" disabled={skip + LIMIT >= total} onClick={() => setSkip(skip + LIMIT)}>Вперёд →</button>
        </div>
      )}

      {modal && <AdExpenseModal open={modal} onClose={() => setModal(false)} onSaved={load} expense={editing} sources={sources} />}
    </div>
  );
}

function AdExpenseModal({ open, onClose, onSaved, expense, sources }: { open: boolean; onClose: () => void; onSaved: () => void; expense: AdExpense | null; sources: LeadSource[] }) {
  const [date, setDate] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [adAccount, setAdAccount] = useState("");
  const [campaign, setCampaign] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setDate(expense.date);
      setSourceId(expense.source_id ? String(expense.source_id) : "");
      setAdAccount(expense.ad_account);
      setCampaign(expense.campaign_name);
      setAmount(String(expense.amount));
      setComment(expense.comment);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setSourceId(""); setAdAccount(""); setCampaign(""); setAmount(""); setComment("");
    }
  }, [open, expense]);

  async function save() {
    if (!amount || isNaN(Number(amount))) { alert("Введите сумму"); return; }
    setSaving(true);
    try {
      const payload = { date, source_id: sourceId ? Number(sourceId) : null, ad_account: adAccount, campaign_name: campaign, amount: Number(amount), comment };
      if (expense) await api.updateAdExpense(expense.id, payload);
      else await api.createAdExpense(payload);
      onClose(); onSaved();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={expense ? "Редактировать расход" : "Новый рекламный расход"} width={460}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>Сохранить</button></>}>
      <div className="field"><label className="field-label">Дата</label><input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label className="field-label">Источник (канал)</label>
        <select className="field-input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">— не указан —</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="field"><label className="field-label">Рекламный кабинет</label><input className="field-input" value={adAccount} onChange={(e) => setAdAccount(e.target.value)} placeholder="Instagram Ads" /></div>
      <div className="field"><label className="field-label">Кампания</label><input className="field-input" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Лидген чат-бот" /></div>
      <div className="field"><label className="field-label">Сумма (сом)</label><input className="field-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25000" /></div>
      <div className="field"><label className="field-label">Комментарий</label><input className="field-input" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
    </Modal>
  );
}

function MetricsTab() {
  const [fFrom, setFFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [fTo, setFTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [metrics, setMetrics] = useState<{ by_source: SourceMetric[]; totals: MarketingTotals } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.marketingMetrics({ date_from: fFrom || undefined, date_to: fTo || undefined })
      .then(setMetrics).catch(() => {}).finally(() => setLoading(false));
  }, [fFrom, fTo]);
  useEffect(() => { load(); }, [load]);

  function fmt(n: number) { return n.toLocaleString("ru-RU"); }
  function fmtRomi(r: number | null) { if (r === null) return "—"; return (r >= 0 ? "+" : "") + r.toFixed(1) + "%"; }
  function romiColor(r: number | null) { if (r === null) return "var(--text3)"; return r >= 100 ? "var(--green)" : r >= 0 ? "var(--yellow, #ca8a04)" : "var(--red)"; }

  const t = metrics?.totals;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input className="field-input" style={{ width: "auto" }} type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        <span style={{ color: "var(--text3)" }}>—</span>
        <input className="field-input" style={{ width: "auto" }} type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        <button className="btn btn-ghost" onClick={load}>Обновить</button>
      </div>

      {t && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            ["Расход за месяц", fmt(t.spend_month) + " сом", ""],
            ["Расход за период", fmt(t.spend_period) + " сом", ""],
            ["Всего лидов", String(t.leads_total), ""],
            ["CPL", fmt(t.cpl) + " сом", ""],
            ["Оплаченных", String(t.paid_count), ""],
            ["CAC", fmt(t.cac) + " сом", ""],
            ["Выручка", fmt(t.revenue) + " сом", ""],
            ["ROMI", fmtRomi(t.romi), romiColor(t.romi)],
          ].map(([label, val, color]) => (
            <div key={label} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: color || "var(--text)" }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}><div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Источник</th>
              <th>Расход</th>
              <th>Лидов</th>
              <th>CPL</th>
              <th>Оплачено</th>
              <th>CAC</th>
              <th>Выручка</th>
              <th>ROMI</th>
              <th>Конверсия</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ textAlign: "center", padding: "30px", color: "var(--text3)" }}>Загрузка…</td></tr>}
            {!loading && (metrics?.by_source ?? []).filter(s => s.spend > 0 || s.leads_count > 0).map((s) => (
              <tr key={s.source_id}>
                <td style={{ fontWeight: 500 }}>{s.source_name}</td>
                <td>{fmt(s.spend)} сом</td>
                <td>{s.leads_count}</td>
                <td>{s.cpl ? fmt(s.cpl) + " сом" : "—"}</td>
                <td>{s.paid_count}</td>
                <td>{s.cac ? fmt(s.cac) + " сом" : "—"}</td>
                <td>{fmt(s.revenue)} сом</td>
                <td style={{ fontWeight: 600, color: romiColor(s.romi) }}>{fmtRomi(s.romi)}</td>
                <td>{s.conversion_pct.toFixed(1)}%</td>
              </tr>
            ))}
            {!loading && (metrics?.by_source ?? []).filter(s => s.spend > 0 || s.leads_count > 0).length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text3)", padding: "40px 20px" }}>Нет данных за выбранный период.</td></tr>
            )}
          </tbody>
        </table>
      </div></div>
    </div>
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
