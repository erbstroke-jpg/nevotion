"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Modal } from "@/components/Modal";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { leadApi, settingsApi, api, analyticsApi } from "@/lib/api";
import type {
  Lead, LeadListResponse, LeadStats, LeadSource, ServiceItem, LeadStage,
  UserWithStats,
} from "@/lib/types";

function KpiCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4, minWidth: 140, flex: "1 1 140px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text3)", fontSize: 12, marginBottom: 2 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text1)" }}>{value}</div>
    </div>
  );
}

function DateRange({ from, to, onFrom, onTo, onReset }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; onReset?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", height: 34 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text3)", padding: "0 8px", flexShrink: 0 }}>calendar_today</span>
      <input type="date" value={from} onChange={e => onFrom(e.target.value)}
        style={{ border: "none", background: "transparent", outline: "none", fontFamily: "inherit", fontSize: 12, color: "var(--text2)", width: 116, padding: "0 4px", cursor: "pointer" }} />
      <span style={{ color: "var(--text3)", fontSize: 12, padding: "0 4px" }}>—</span>
      <input type="date" value={to} onChange={e => onTo(e.target.value)}
        style={{ border: "none", background: "transparent", outline: "none", fontFamily: "inherit", fontSize: 12, color: "var(--text2)", width: 116, padding: "0 4px", cursor: "pointer" }} />
      {onReset && (from || to) && (
        <button onClick={onReset} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text3)", padding: "0 8px", display: "flex", alignItems: "center", height: "100%", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      )}
    </div>
  );
}

function StageBadge({ stage }: { stage: LeadStage | null }) {
  if (!stage) return <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: stage.color + "22", color: stage.color,
    }}>{stage.name}</span>
  );
}

function fmtMoney(v: number) {
  return v ? v.toLocaleString("ru-RU") + " с" : "—";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const Y = iso.slice(0, 4);
  const M = iso.slice(5, 7);
  const D = iso.slice(8, 10);
  return `${D}.${M}.${Y}`;
}

function CreateLeadModal({ open, onClose, sources, services, stages, users, currentUserId, isAdmin, onCreated }: {
  open: boolean; onClose: () => void;
  sources: LeadSource[]; services: ServiceItem[]; stages: LeadStage[]; users: UserWithStats[];
  currentUserId?: number; isAdmin: boolean;
  onCreated: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    client_name: "", company_name: "", phone: "", source_id: "", service_id: "",
    stage_id: "", setter_id: "", closer_id: "", potential_amount: "", comment: "",
  });
  const [saving, setSaving] = useState(false);
  const [dupe, setDupe] = useState<{ id: number; client_name: string } | null>(null);

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function submit(force = false) {
    if (!form.client_name.trim()) { toast("Укажите имя клиента", "error"); return; }
    setSaving(true);
    try {
      await leadApi.create({
        client_name: form.client_name.trim(),
        company_name: form.company_name.trim(),
        phone: form.phone.trim(),
        source_id: form.source_id ? Number(form.source_id) : null,
        service_id: form.service_id ? Number(form.service_id) : null,
        stage_id: form.stage_id ? Number(form.stage_id) : null,
        setter_id: form.setter_id ? Number(form.setter_id) : (currentUserId ?? null),
        closer_id: form.closer_id ? Number(form.closer_id) : null,
        potential_amount: form.potential_amount ? Number(form.potential_amount) : 0,
        comment: form.comment,
        force,
      });
      toast("Лид создан", "success");
      onCreated();
      onClose();
    } catch (err: any) {
      // Try to detect duplicate 409
      const msg: string = err.message || "";
      if (msg.includes("existing")) {
        try {
          const match = msg.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.existing) { setDupe(parsed.existing); setSaving(false); return; }
          }
        } catch {}
      }
      toast(msg || "Ошибка создания", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal open title="Новый лид" onClose={onClose}>
      {dupe && (
        <div style={{ background: "rgba(181,93,0,.1)", border: "1px solid #b55d00", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: "#b55d00", marginBottom: 6 }}>⚠️ Лид с таким номером уже существует</div>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>Клиент: <b>{dupe.client_name}</b></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { onClose(); router.push(`/leads/${dupe.id}`); }}>Открыть существующий</button>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => { setDupe(null); submit(true); }}>Всё равно создать</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDupe(null)}>Отмена</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Имя клиента *</label>
          <input className="form-input" value={form.client_name} onChange={f("client_name")} placeholder="Алибек Джумалиев" />
        </div>
        <div>
          <label className="form-label">Компания</label>
          <input className="form-input" value={form.company_name} onChange={f("company_name")} placeholder="ООО Пример" />
        </div>
        <div>
          <label className="form-label">Телефон</label>
          <input className="form-input" value={form.phone} onChange={f("phone")} placeholder="+996 700 000000" />
        </div>
        <div>
          <label className="form-label">Источник</label>
          <select className="form-input" value={form.source_id} onChange={f("source_id")}>
            <option value="">— не выбрано —</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Услуга</label>
          <select className="form-input" value={form.service_id} onChange={f("service_id")}>
            <option value="">— не выбрано —</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Этап</label>
          <select className="form-input" value={form.stage_id} onChange={f("stage_id")}>
            <option value="">— по умолчанию —</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Потенциал (сом)</label>
          <input className="form-input" type="number" value={form.potential_amount} onChange={f("potential_amount")} placeholder="0" />
        </div>
        {isAdmin && <>
          <div>
            <label className="form-label">Сеттер</label>
            <select className="form-input" value={form.setter_id} onChange={f("setter_id")}>
              <option value="">— текущий пользователь —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Клоузер</label>
            <select className="form-input" value={form.closer_id} onChange={f("closer_id")}>
              <option value="">— не назначен —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </>}
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Комментарий</label>
          <textarea className="form-input" value={form.comment} onChange={f("comment")} rows={2} style={{ resize: "vertical" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={() => submit(false)} disabled={saving}>{saving ? "Создание..." : "Создать лид"}</button>
      </div>
    </Modal>
  );
}

export default function LeadsPage() {
  const { user, isAdmin } = useApp();
  const router = useRouter();

  const [stats, setStats] = useState<LeadStats | null>(null);
  const [data, setData] = useState<LeadListResponse>({ items: [], total: 0 });
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);

  const [search, setSearch] = useState("");
  const [fSource, setFSource] = useState("");
  const [fService, setFService] = useState("");
  const [fSetter, setFSetter] = useState("");
  const [fStage, setFStage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        leadApi.list({
          source_id: fSource ? Number(fSource) : undefined,
          service_id: fService ? Number(fService) : undefined,
          setter_id: fSetter ? Number(fSetter) : undefined,
          stage_id: fStage ? Number(fStage) : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          search: search || undefined,
          limit: LIMIT, offset: off,
        }),
        leadApi.stats({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
      ]);
      setData(d);
      setStats(s);
      setOffset(off);
    } catch {}
    setLoading(false);
  }, [fSource, fService, fSetter, fStage, dateFrom, dateTo, search]);

  useEffect(() => {
    settingsApi.listSources().then(setSources).catch(() => {});
    settingsApi.listServices().then(setServices).catch(() => {});
    settingsApi.listStages().then(setStages).catch(() => {});
    api.listUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => { load(0); }, [load]);

  const totalPages = Math.ceil(data.total / LIMIT);
  const page = Math.floor(offset / LIMIT) + 1;

  return (
    <Shell title="Лиды">
      {/* KPI */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard label="Лидов сегодня" value={stats?.leads_today ?? "—"} icon="today" />
        <KpiCard label="Лидов за период" value={stats?.leads_period ?? "—"} icon="contacts" />
        <KpiCard label="Встреч за период" value={stats?.meetings_period ?? "—"} icon="calendar_month" />
        <KpiCard label="Закрыто в оплату" value={stats?.closed_won ?? "—"} icon="payments" />
        <KpiCard label="Конверсия" value={stats ? `${stats.conversion_pct}%` : "—"} icon="trending_up" />
        <KpiCard label="Потенциал сделок" value={stats ? fmtMoney(stats.potential_sum) : "—"} icon="account_balance_wallet" />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <span className="material-symbols-outlined" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--text3)", pointerEvents: "none" }}>search</span>
            <input className="form-input" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, height: 34, fontSize: 13 }} />
          </div>
          <DateRange from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onReset={() => { setDateFrom(""); setDateTo(""); }} />
          <select className="form-input" value={fSource} onChange={e => setFSource(e.target.value)} style={{ height: 34, fontSize: 12 }}>
            <option value="">Все источники</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="form-input" value={fService} onChange={e => setFService(e.target.value)} style={{ height: 34, fontSize: 12 }}>
            <option value="">Все услуги</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="form-input" value={fStage} onChange={e => setFStage(e.target.value)} style={{ height: 34, fontSize: 12 }}>
            <option value="">Все этапы</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="form-input" value={fSetter} onChange={e => setFSetter(e.target.value)} style={{ height: 34, fontSize: 12 }}>
            <option value="">Все сеттеры</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn" onClick={() => analyticsApi.exportXlsx("leads", { ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) })} style={{ height: 34, fontSize: 13, flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Excel
          </button>
          <button className="btn" onClick={() => setCreateModal(true)} style={{ height: 34, fontSize: 13, flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Новый лид
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
                {["Дата", "Клиент / Компания", "Телефон", "Источник", "Услуга", "Этап", "Сеттер", "Клоузер", "Потенциал", "Следующий шаг"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Загрузка...</td></tr>}
              {!loading && data.items.length === 0 && <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Лиды не найдены</td></tr>}
              {!loading && data.items.map(lead => (
                <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "10px 12px", color: "var(--text3)", whiteSpace: "nowrap" }}>{fmtDate(lead.created_at)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600 }}>{lead.client_name}</div>
                    {lead.company_name && <div style={{ fontSize: 11, color: "var(--text3)" }}>{lead.company_name}</div>}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)", whiteSpace: "nowrap" }}>{lead.phone || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{lead.source?.name || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{lead.service?.name || "—"}</td>
                  <td style={{ padding: "10px 12px" }}><StageBadge stage={lead.stage} /></td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{lead.setter?.name || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{lead.closer?.name || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)", whiteSpace: "nowrap" }}>{fmtMoney(lead.potential_amount)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {lead.next_action_type
                      ? <div><div style={{ fontSize: 12, fontWeight: 500 }}>{lead.next_action_type}</div>
                          {lead.next_action_at && <div style={{ fontSize: 11, color: "var(--text3)" }}>{fmtDate(lead.next_action_at)}</div>}
                        </div>
                      : <span style={{ fontSize: 11, color: "var(--red)", fontStyle: "italic" }}>Не задан</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.total > LIMIT && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>{offset + 1}–{Math.min(offset + LIMIT, data.total)} из {data.total}</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => load(offset - LIMIT)} style={{ fontSize: 12 }}>← Назад</button>
              <span style={{ fontSize: 12, color: "var(--text2)" }}>Стр. {page} из {totalPages}</span>
              <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => load(offset + LIMIT)} style={{ fontSize: 12 }}>Вперёд →</button>
            </div>
          </div>
        )}
      </div>

      {createModal && (
        <CreateLeadModal
          open={createModal} onClose={() => setCreateModal(false)}
          sources={sources} services={services} stages={stages} users={users}
          currentUserId={user?.id} isAdmin={isAdmin}
          onCreated={() => load(0)}
        />
      )}
    </Shell>
  );
}
