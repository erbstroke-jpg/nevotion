"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Modal } from "@/components/Modal";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { leadApi, settingsApi, api } from "@/lib/api";
import Link from "next/link";
import type {
  LeadDetail, LeadStage, LeadSource, ServiceItem, UserWithStats,
  LeadActivity, LeadFile, Project,
} from "@/lib/types";
import { ACTIVITY_TYPES, FILE_TYPES } from "@/lib/types";

// ── utils ────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const D = iso.slice(8, 10), M = iso.slice(5, 7), Y = iso.slice(0, 4);
  return `${D}.${M}.${Y}`;
}
// Convert ISO UTC → "YYYY-MM-DDTHH:MM" in Asia/Bishkek (UTC+6)
function utcToLocal(s: string): string {
  const Y = +s.slice(0, 4), Mo = +s.slice(5, 7) - 1, D = +s.slice(8, 10);
  const h = +s.slice(11, 13), m = +s.slice(14, 16);
  const ms = Date.UTC(Y, Mo, D, h, m) + 6 * 3600 * 1000;
  const ld = new Date(ms);
  return `${ld.getUTCFullYear()}-${String(ld.getUTCMonth()+1).padStart(2,"0")}-${String(ld.getUTCDate()).padStart(2,"0")}T${String(ld.getUTCHours()).padStart(2,"0")}:${String(ld.getUTCMinutes()).padStart(2,"0")}`;
}
// Convert "YYYY-MM-DDTHH:MM" (Bishkek local) → ISO UTC string for backend
function localToUTC(s: string): string {
  const [d, t = "00:00"] = s.split("T");
  const [Y, Mo, D] = d.split("-").map(Number);
  const [h, m] = t.split(":").map(Number);
  return new Date(Date.UTC(Y, Mo - 1, D, h - 6, m)).toISOString();
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const local = utcToLocal(iso);
  const D = local.slice(8, 10), M = local.slice(5, 7), Y = local.slice(0, 4);
  const h = local.slice(11, 13), m = local.slice(14, 16);
  return `${D}.${M}.${Y} ${h}:${m}`;
}
function fmtMoney(v: number) { return v ? v.toLocaleString("ru-RU") + " с" : "—"; }
function daysSince(iso: string | null) {
  if (!iso) return null;
  const Y = parseInt(iso.slice(0, 4)), M = parseInt(iso.slice(5, 7)) - 1, D = parseInt(iso.slice(8, 10));
  const diff = Date.now() - new Date(Y, M, D).getTime();
  return Math.floor(diff / 86400000);
}

// ── StageBadge ───────────────────────────────────────────────────
function StageBadge({ stage }: { stage: LeadStage | null }) {
  if (!stage) return <span style={{ color: "var(--text3)" }}>—</span>;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: stage.color + "22", color: stage.color }}>
      {stage.name}
    </span>
  );
}

// ── Section ──────────────────────────────────────────────────────
function Section({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, color: "var(--text1)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>{icon}</span>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: "var(--text3)", paddingTop: 2 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: "var(--text1)" }}>{value || <span style={{ color: "var(--text3)" }}>—</span>}</div>
    </div>
  );
}

// ── Stage Line ───────────────────────────────────────────────────
function StageLine({ stages, currentStageId, history }: {
  stages: LeadStage[];
  currentStageId: number | null;
  history: LeadDetail["stage_history"];
}) {
  const entryDates: Record<number, string> = {};
  for (const h of history) {
    if (h.to_stage_id && !entryDates[h.to_stage_id]) entryDates[h.to_stage_id] = h.created_at;
  }

  return (
    <div style={{ display: "flex", gap: 0, flexWrap: "wrap", alignItems: "center" }}>
      {stages.map((s, i) => {
        const isCurrent = s.id === currentStageId;
        const isPast = !!entryDates[s.id] && !isCurrent;
        const entryDate = entryDates[s.id];
        const daysOnCurrent = isCurrent ? daysSince(entryDate) : null;

        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: isCurrent ? s.color : isPast ? s.color + "44" : "var(--bg3)",
                color: isCurrent ? "#fff" : isPast ? s.color : "var(--text3)",
                fontSize: 11, fontWeight: 700, border: isCurrent ? `2px solid ${s.color}` : "2px solid transparent",
                transition: "all 0.2s",
              }}>
                {isPast ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> : i + 1}
              </div>
              <div style={{ fontSize: 9, color: isCurrent ? s.color : "var(--text3)", fontWeight: isCurrent ? 700 : 400, maxWidth: 64, textAlign: "center", lineHeight: 1.2 }}>
                {s.name}
              </div>
              {isCurrent && daysOnCurrent !== null && (
                <div style={{ fontSize: 9, color: "var(--text3)" }}>{daysOnCurrent}д</div>
              )}
              {isPast && entryDate && (
                <div style={{ fontSize: 9, color: "var(--text3)" }}>{fmtDate(entryDate)}</div>
              )}
            </div>
            {i < stages.length - 1 && (
              <div style={{ width: 20, height: 2, background: isPast || isCurrent ? s.color + "66" : "var(--border)", margin: "0 2px", marginBottom: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────
function Timeline({ events }: { events: LeadDetail["timeline"] }) {
  return (
    <div style={{ position: "relative" }}>
      {events.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--primary)" }}>{e.icon}</span>
            </div>
            {i < events.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 14 }} />}
          </div>
          <div style={{ paddingTop: 4, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{e.label}</div>
            {e.description && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{e.description}</div>}
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{fmtDateTime(e.at)}</div>
          </div>
        </div>
      ))}
      {events.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>Нет событий</div>}
    </div>
  );
}

// ── Add Activity Modal ───────────────────────────────────────────
function AddActivityModal({ leadId, users, onClose, onAdded }: {
  leadId: number; users: UserWithStats[]; onClose: () => void; onAdded: () => void;
}) {
  const toast = useToast();
  const { user } = useApp();
  const [form, setForm] = useState({ activity_type: ACTIVITY_TYPES[0] as string, channel: "", description: "", responsible_id: "" });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await leadApi.addActivity(leadId, {
        activity_type: form.activity_type,
        channel: form.channel,
        description: form.description,
        responsible_id: form.responsible_id ? Number(form.responsible_id) : user?.id,
      });
      toast("Касание добавлено", "success");
      onAdded();
      onClose();
    } catch (e: any) { toast(e.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal open title="Добавить касание" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="form-label">Тип касания</label>
          <select className="form-input" value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Канал</label>
          <input className="form-input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} placeholder="WhatsApp, телефон, почта..." />
        </div>
        <div>
          <label className="form-label">Содержание</label>
          <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} />
        </div>
        <div>
          <label className="form-label">Ответственный</label>
          <select className="form-input" value={form.responsible_id} onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value }))}>
            <option value="">— текущий пользователь —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? "Сохранение..." : "Добавить"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add File Modal ───────────────────────────────────────────────
function AddFileModal({ leadId, onClose, onAdded }: { leadId: number; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", url: "", file_type: FILE_TYPES[0] as string });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.url.trim()) { toast("Заполните название и ссылку", "error"); return; }
    setSaving(true);
    try {
      await leadApi.addFile(leadId, { name: form.name, url: form.url, file_type: form.file_type });
      toast("Файл добавлен", "success");
      onAdded(); onClose();
    } catch (e: any) { toast(e.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal open title="Добавить файл / ссылку" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="form-label">Тип документа</label>
          <select className="form-input" value={form.file_type} onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))}>
            {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Название</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="КП для клиента" />
        </div>
        <div>
          <label className="form-label">Ссылка (URL)</label>
          <input className="form-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://docs.google.com/..." />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? "Сохранение..." : "Добавить"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Change Stage Modal ───────────────────────────────────────────
function ChangeStageModal({ lead, stages, onClose, onChanged }: {
  lead: LeadDetail; stages: LeadStage[]; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [stageId, setStageId] = useState(String(lead.stage_id ?? ""));
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!stageId) { toast("Выберите этап", "error"); return; }
    setSaving(true);
    try {
      await leadApi.changeStage(lead.id, Number(stageId), comment);
      toast("Этап изменён", "success");
      onChanged(); onClose();
    } catch (e: any) { toast(e.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal open title="Сменить этап" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="form-label">Новый этап</label>
          <select className="form-input" value={stageId} onChange={e => setStageId(e.target.value)}>
            <option value="">— выберите —</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Комментарий</label>
          <textarea className="form-input" rows={2} value={comment} onChange={e => setComment(e.target.value)} style={{ resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? "Сохранение..." : "Сменить этап"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Edit Lead Modal ──────────────────────────────────────────────
function EditLeadModal({ lead, sources, services, users, onClose, onSaved }: {
  lead: LeadDetail; sources: LeadSource[]; services: ServiceItem[];
  users: UserWithStats[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    client_name: lead.client_name,
    company_name: lead.company_name,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    instagram: lead.instagram,
    email: lead.email,
    address: lead.address,
    website: lead.website,
    industry: lead.industry,
    employees_count: lead.employees_count != null ? String(lead.employees_count) : "",
    source_id: lead.source_id != null ? String(lead.source_id) : "",
    service_id: lead.service_id != null ? String(lead.service_id) : "",
    setter_id: lead.setter_id != null ? String(lead.setter_id) : "",
    closer_id: lead.closer_id != null ? String(lead.closer_id) : "",
    potential_amount: String(lead.potential_amount),
    next_action_type: lead.next_action_type,
    next_action_at: lead.next_action_at ? utcToLocal(lead.next_action_at) : "",
    comment: lead.comment,
  });
  const [saving, setSaving] = useState(false);

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function submit() {
    setSaving(true);
    try {
      await leadApi.update(lead.id, {
        client_name: form.client_name || undefined,
        company_name: form.company_name,
        phone: form.phone,
        whatsapp: form.whatsapp,
        instagram: form.instagram,
        email: form.email,
        address: form.address,
        website: form.website,
        industry: form.industry,
        employees_count: form.employees_count ? Number(form.employees_count) : null,
        source_id: form.source_id ? Number(form.source_id) : null,
        service_id: form.service_id ? Number(form.service_id) : null,
        setter_id: form.setter_id ? Number(form.setter_id) : null,
        closer_id: form.closer_id ? Number(form.closer_id) : null,
        potential_amount: form.potential_amount ? Number(form.potential_amount) : 0,
        next_action_type: form.next_action_type,
        next_action_at: form.next_action_at ? localToUTC(form.next_action_at) : null,
        comment: form.comment,
      });
      toast("Лид обновлён", "success");
      onSaved(); onClose();
    } catch (e: any) { toast(e.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal open title="Редактировать лид" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", maxHeight: "70vh", overflowY: "auto", padding: "4px 2px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Имя клиента *</label>
          <input className="form-input" value={form.client_name} onChange={f("client_name")} />
        </div>
        <div>
          <label className="form-label">Компания</label>
          <input className="form-input" value={form.company_name} onChange={f("company_name")} />
        </div>
        <div>
          <label className="form-label">Телефон</label>
          <input className="form-input" value={form.phone} onChange={f("phone")} />
        </div>
        <div>
          <label className="form-label">WhatsApp</label>
          <input className="form-input" value={form.whatsapp} onChange={f("whatsapp")} />
        </div>
        <div>
          <label className="form-label">Instagram</label>
          <input className="form-input" value={form.instagram} onChange={f("instagram")} />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input className="form-input" value={form.email} onChange={f("email")} />
        </div>
        <div>
          <label className="form-label">Адрес</label>
          <input className="form-input" value={form.address} onChange={f("address")} />
        </div>
        <div>
          <label className="form-label">Сайт</label>
          <input className="form-input" value={form.website} onChange={f("website")} />
        </div>
        <div>
          <label className="form-label">Отрасль</label>
          <input className="form-input" value={form.industry} onChange={f("industry")} />
        </div>
        <div>
          <label className="form-label">Кол-во сотрудников</label>
          <input className="form-input" type="number" value={form.employees_count} onChange={f("employees_count")} />
        </div>
        <div>
          <label className="form-label">Источник</label>
          <select className="form-input" value={form.source_id} onChange={f("source_id")}>
            <option value="">—</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Услуга</label>
          <select className="form-input" value={form.service_id} onChange={f("service_id")}>
            <option value="">—</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Сеттер</label>
          <select className="form-input" value={form.setter_id} onChange={f("setter_id")}>
            <option value="">—</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Клоузер</label>
          <select className="form-input" value={form.closer_id} onChange={f("closer_id")}>
            <option value="">—</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Потенциал (сом)</label>
          <input className="form-input" type="number" value={form.potential_amount} onChange={f("potential_amount")} />
        </div>
        <div>
          <label className="form-label">Следующий шаг</label>
          <input className="form-input" value={form.next_action_type} onChange={f("next_action_type")} placeholder="Позвонить, отправить КП..." />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Дата следующего действия</label>
          <input className="form-input" type="datetime-local" value={form.next_action_at} onChange={f("next_action_at")} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Комментарий</label>
          <textarea className="form-input" rows={3} value={form.comment} onChange={f("comment")} style={{ resize: "vertical" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={submit} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
      </div>
    </Modal>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, isAdmin } = useApp();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);

  const [editModal, setEditModal] = useState(false);
  const [stageModal, setStageModal] = useState(false);
  const [actModal, setActModal] = useState(false);
  const [fileModal, setFileModal] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const d = await leadApi.get(Number(id));
      setLead(d);
      // Check for linked project in dev
      api.listProjects().then(prjs => {
        const proj = prjs.find(p => p.lead_id === d.id) ?? null;
        setLinkedProject(proj);
      }).catch(() => {});
    } catch { toast("Лид не найден", "error"); router.push("/leads"); }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    settingsApi.listStages().then(setStages).catch(() => {});
    settingsApi.listSources().then(setSources).catch(() => {});
    settingsApi.listServices().then(setServices).catch(() => {});
    api.listUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleArchive() {
    if (!lead) return;
    if (!confirm("Архивировать лид?")) return;
    try {
      await leadApi.archive(lead.id);
      toast("Лид архивирован", "success");
      router.push("/leads");
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function deleteFile(fileId: number) {
    if (!lead) return;
    if (!confirm("Удалить файл?")) return;
    try {
      await leadApi.deleteFile(lead.id, fileId);
      toast("Файл удалён", "success");
      reload();
    } catch (e: any) { toast(e.message, "error"); }
  }

  if (loading) return <Shell title="Лид"><div style={{ padding: 40, color: "var(--text3)", textAlign: "center" }}>Загрузка...</div></Shell>;
  if (!lead) return null;

  const noNextAction = !lead.next_action_type;

  return (
    <Shell title={lead.client_name}>
      {/* Header */}
      <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text1)" }}>{lead.client_name}</div>
              {lead.company_name && <div style={{ fontSize: 14, color: "var(--text3)" }}>{lead.company_name}</div>}
              <StageBadge stage={lead.stage} />
              {lead.status === "archived" && (
                <span style={{ padding: "2px 8px", borderRadius: 8, background: "var(--bg3)", color: "var(--text3)", fontSize: 11 }}>Архив</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", fontSize: 13, color: "var(--text3)" }}>
              {lead.phone && <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>phone</span> {lead.phone}</span>}
              {lead.whatsapp && <span>WhatsApp: {lead.whatsapp}</span>}
              {lead.instagram && <span>Instagram: {lead.instagram}</span>}
              {lead.potential_amount > 0 && (
                <span style={{ color: "var(--primary)", fontWeight: 600 }}>{fmtMoney(lead.potential_amount)}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "var(--text3)" }}>
              {lead.setter && <span>Сеттер: <b style={{ color: "var(--text2)" }}>{lead.setter.name}</b></span>}
              {lead.closer && <span>Клоузер: <b style={{ color: "var(--text2)" }}>{lead.closer.name}</b></span>}
              {lead.source && <span>Источник: {lead.source.name}</span>}
              {lead.service && <span>Услуга: {lead.service.name}</span>}
              <span>Создан: {fmtDate(lead.created_at)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
            <button className="btn btn-ghost" onClick={() => setEditModal(true)} style={{ fontSize: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span> Изменить
            </button>
            <button className="btn btn-ghost" onClick={() => setStageModal(true)} style={{ fontSize: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>swap_horiz</span> Сменить этап
            </button>
            <button className="btn btn-ghost" onClick={() => setActModal(true)} style={{ fontSize: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_comment</span> Касание
            </button>
            <button className="btn btn-ghost" onClick={handleArchive} style={{ fontSize: 12, color: "var(--red)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>archive</span> Архивировать
            </button>
          </div>
        </div>
      </div>

      {/* Stage line */}
      <Section title="Этапы сделки" icon="linear_scale">
        <StageLine stages={stages} currentStageId={lead.stage_id} history={lead.stage_history} />
      </Section>

      {/* Next action */}
      <Section title="Следующее действие" icon="event_upcoming">
        {noNextAction ? (
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--red-bg, rgba(186,26,26,.1))", border: "1px solid var(--red)", color: "var(--red)", fontSize: 13, fontWeight: 500 }}>
            ⚠️ Следующее действие не задано — назначьте его в редактировании лида
          </div>
        ) : (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
            <div><span style={{ color: "var(--text3)", marginRight: 6 }}>Тип:</span>{lead.next_action_type}</div>
            {lead.next_action_at && <div><span style={{ color: "var(--text3)", marginRight: 6 }}>Дата:</span>{fmtDateTime(lead.next_action_at)}</div>}
          </div>
        )}
      </Section>

      <div className="lead-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Main info */}
        <Section title="Основная информация" icon="info">
          <Row label="Компания" value={lead.company_name} />
          <Row label="Телефон" value={lead.phone} />
          <Row label="WhatsApp" value={lead.whatsapp} />
          <Row label="Instagram" value={lead.instagram} />
          <Row label="Email" value={lead.email} />
          <Row label="Адрес" value={lead.address} />
          <Row label="Сайт" value={lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>{lead.website}</a> : null} />
          <Row label="Отрасль" value={lead.industry} />
          <Row label="Кол-во сотрудников" value={lead.employees_count} />
          <Row label="Источник" value={lead.source?.name} />
          <Row label="Услуга" value={lead.service?.name} />
          <Row label="Сеттер" value={lead.setter?.name} />
          <Row label="Клоузер" value={lead.closer?.name} />
          <Row label="Дата создания" value={fmtDate(lead.created_at)} />
          <Row label="Обновлён" value={fmtDate(lead.updated_at)} />
          {lead.comment && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--bg2)", borderRadius: 8, fontSize: 13, color: "var(--text2)" }}>
              {lead.comment}
            </div>
          )}
        </Section>

        {/* Financial summary — real Deal data */}
        <div>
          <Section title="Финансовая сводка" icon="account_balance_wallet">
            {(() => {
              const deal = lead.active_deal;
              const isPaid = deal?.status === "paid";
              const pending = <span style={{ color: "var(--text3)", fontStyle: "italic" }}>после оплаты</span>;
              return (
                <>
                  <Row label="Потенциал" value={fmtMoney(lead.potential_amount)} />
                  <Row
                    label="Факт. оплата"
                    value={
                      isPaid
                        ? <span style={{ color: "var(--green)", fontWeight: 600 }}>{fmtMoney(deal!.paid_amount)}</span>
                        : (deal?.amount ? <span style={{ color: "var(--yellow)" }}>{fmtMoney(deal.amount)} (ожидается)</span> : pending)
                    }
                  />
                  <Row
                    label="Статус оплаты"
                    value={
                      isPaid
                        ? <span style={{ background: "var(--green-bg)", color: "var(--green)", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>✓ Оплачено {deal?.payment_date ? fmtDate(deal.payment_date) : ""}</span>
                        : <span style={{ background: "var(--bg3)", color: "var(--text3)", padding: "2px 8px", borderRadius: 5, fontSize: 11 }}>Ожидается</span>
                    }
                  />
                  {isPaid && deal && (
                    <>
                      <Row label="Способ оплаты" value={deal.payment_method || "—"} />
                      <Row
                        label="Комиссия сеттера"
                        value={deal.setter_commission > 0
                          ? <span style={{ color: "var(--primary)", fontWeight: 600 }}>{fmtMoney(deal.setter_commission)}</span>
                          : pending}
                      />
                      <Row
                        label="Комиссия клоузера"
                        value={deal.closer_commission > 0
                          ? <span style={{ color: "var(--primary)", fontWeight: 600 }}>{fmtMoney(deal.closer_commission)}</span>
                          : pending}
                      />
                      <Row
                        label="Маржа"
                        value={(() => {
                          const margin = deal.paid_amount - deal.setter_commission - deal.closer_commission;
                          return <span style={{ color: margin >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{fmtMoney(margin)}</span>;
                        })()}
                      />
                    </>
                  )}
                  {!isPaid && deal?.expected_payment_date && (
                    <Row label="Ожид. оплата" value={fmtDate(deal.expected_payment_date)} />
                  )}
                </>
              );
            })()}
          </Section>

          {/* Linked project */}
          {linkedProject && (
            <Section title="Проект в разработке" icon="code">
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", background: "var(--primary-dim)",
                borderRadius: 8, marginBottom: 8,
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: 14 }}>{linkedProject.company}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                    {linkedProject.sub_status || "Без подстатуса"}
                    {linkedProject.bot_comment ? ` · ${linkedProject.bot_comment}` : ""}
                  </div>
                </div>
                <Link href="/dept/dev">
                  <button className="btn btn-ghost" style={{ fontSize: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                    Разработка
                  </button>
                </Link>
              </div>
            </Section>
          )}
        </div>

          {/* Meetings */}
          <Section title={`Встречи (${lead.meetings.length})`} icon="calendar_month">
            {lead.meetings.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>Встреч нет</div>}
            {lead.meetings.map(m => (
              <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{m.client_name}</div>
                <div style={{ color: "var(--text3)", fontSize: 12 }}>
                  {fmtDateTime(m.meeting_date)} · {m.closer?.name || "—"}
                </div>
              </div>
            ))}
          </Section>

          {/* Tasks */}
          <Section title={`Задачи (${lead.tasks.length})`} icon="task_alt">
            {lead.tasks.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>Задач нет</div>}
            {lead.tasks.map(t => (
              <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <div style={{ fontWeight: 600, textDecoration: t.completed_at ? "line-through" : "none", color: t.completed_at ? "var(--text3)" : "var(--text1)" }}>{t.title}</div>
                <div style={{ color: "var(--text3)", fontSize: 12 }}>
                  {t.owner?.name || "—"}{t.due_date ? ` · до ${fmtDate(t.due_date)}` : ""}
                </div>
              </div>
            ))}
          </Section>
      </div>

      {/* Activities */}
      <Section title="История касаний" icon="history"
        action={<button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setActModal(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span> Добавить
        </button>}>
        {lead.activities.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>Касаний ещё нет</div>}
        {lead.activities.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg2)" }}>
                {["Дата", "Тип", "Канал", "Содержание", "Ответственный"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lead.activities.map((a: LeadActivity) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 10px", color: "var(--text3)", whiteSpace: "nowrap" }}>{fmtDateTime(a.created_at)}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{a.activity_type}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text2)" }}>{a.channel || "—"}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text2)" }}>{a.description || "—"}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text2)" }}>{a.responsible?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Timeline */}
      <Section title="Таймлайн событий" icon="timeline">
        <Timeline events={lead.timeline} />
      </Section>

      {/* Files */}
      <Section title="Файлы и документы" icon="attach_file"
        action={<button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFileModal(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span> Добавить
        </button>}>
        {lead.files.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>Файлов нет</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lead.files.map((f: LeadFile) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg2)", borderRadius: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>description</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>{f.name}</a>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{f.file_type}{f.uploader ? ` · ${f.uploader.name}` : ""} · {fmtDate(f.created_at)}</div>
              </div>
              <button onClick={() => deleteFile(f.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text3)", display: "flex" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Modals */}
      {editModal && <EditLeadModal lead={lead} sources={sources} services={services} users={users} onClose={() => setEditModal(false)} onSaved={reload} />}
      {stageModal && <ChangeStageModal lead={lead} stages={stages} onClose={() => setStageModal(false)} onChanged={reload} />}
      {actModal && <AddActivityModal leadId={lead.id} users={users} onClose={() => setActModal(false)} onAdded={reload} />}
      {fileModal && <AddFileModal leadId={lead.id} onClose={() => setFileModal(false)} onAdded={reload} />}
    </Shell>
  );
}
