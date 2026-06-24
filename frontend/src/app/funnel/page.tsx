"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, DragStartEvent, DragEndEvent, useDroppable,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Shell } from "@/components/Shell";
import { Modal } from "@/components/Modal";
import { useToast } from "@/context/ToastContext";
import { leadApi, settingsApi } from "@/lib/api";
import { api } from "@/lib/api";
import type { FunnelCard, FunnelStats, LeadStage, User, LeadSource, ServiceItem, RejectReason, FunnelResponse } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

// ──────────────────────────── Helpers ────────────────────────────

function fmtMoney(n: number) {
  if (!n) return "—";
  return n.toLocaleString("ru-RU") + " сом";
}

function fmtDate(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  const m = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}

function isOverdue(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

function cardHighlight(card: FunnelCard, stage: LeadStage | null): "red" | "yellow" | "green" | null {
  if (stage?.is_won) return "green";
  if (card.next_action_at && isOverdue(card.next_action_at)) return "red";
  if (stage?.norm_days && card.days_in_stage > stage.norm_days) return "yellow";
  return null;
}

// Stage keyword → kind mapping (mirrors backend _stage_kind)
function stageKind(s: LeadStage): "meeting" | "contract" | "waiting_payment" | "won" | "lost" | "generic" {
  const n = s.name.toLowerCase();
  if (s.is_lost || n.includes("минус")) return "lost";
  if (s.is_won || n.includes("оплач")) return "won";
  if (n.includes("встреч")) return "meeting";
  if (n.includes("договор")) return "contract";
  if (n.includes("ожидани") || n.includes("ожид")) return "waiting_payment";
  return "generic";
}

// ──────────────────────────── Stage Transition Modal ─────────────

interface TransitionModalProps {
  stage: LeadStage;
  card: FunnelCard;
  users: User[];
  rejectReasons: RejectReason[];
  onConfirm: (comment: string, extra: Record<string, any>) => void;
  onCancel: () => void;
}

function TransitionModal({ stage, card, users, rejectReasons, onConfirm, onCancel }: TransitionModalProps) {
  const kind = stageKind(stage);
  const [comment, setComment] = useState("");
  const [extra, setExtra] = useState<Record<string, any>>({});

  function set(key: string, val: any) {
    setExtra(prev => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(comment, extra);
  }

  const needsForm = kind !== "generic";

  return (
    <Modal open={true} title={`Переход: ${stage.name}`} onClose={onCancel} width={480}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text2)", padding: "8px 12px", background: "var(--bg3)", borderRadius: 8 }}>
          <strong>{card.client_name}</strong>{card.company_name ? ` · ${card.company_name}` : ""}
        </div>

        {kind === "meeting" && (
          <>
            <label className="form-label">Дата встречи <span style={{ color: "var(--red)" }}>*</span>
              <input className="form-input" type="date" required
                onChange={e => set("meeting_date", e.target.value)} />
            </label>
            <label className="form-label">Время
              <input className="form-input" type="time" defaultValue="12:00"
                onChange={e => set("meeting_time", e.target.value)} />
            </label>
            <label className="form-label">Адрес / ссылка
              <input className="form-input" type="text" placeholder="Офис, Zoom..."
                onChange={e => set("address", e.target.value)} />
            </label>
            <label className="form-label">Клоузер <span style={{ color: "var(--red)" }}>*</span>
              <select className="form-input" required onChange={e => set("closer_id", Number(e.target.value))}>
                <option value="">— выбрать —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </>
        )}

        {kind === "contract" && (
          <>
            <label className="form-label">Сумма сделки <span style={{ color: "var(--red)" }}>*</span>
              <input className="form-input" type="number" min={0} required
                defaultValue={card.potential_amount || ""}
                onChange={e => set("amount", Number(e.target.value))} />
            </label>
            <label className="form-label">Дата отправки договора
              <input className="form-input" type="date"
                onChange={e => set("contract_sent_at", e.target.value)} />
            </label>
            <label className="form-label">Ожидаемая дата оплаты
              <input className="form-input" type="date"
                onChange={e => set("expected_payment_date", e.target.value)} />
            </label>
            <label className="form-label">Ответственный
              <select className="form-input" onChange={e => set("responsible_id", Number(e.target.value))}>
                <option value="">— выбрать —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </>
        )}

        {kind === "waiting_payment" && (
          <>
            <label className="form-label">Сумма к оплате
              <input className="form-input" type="number" min={0}
                defaultValue={card.active_deal?.amount || card.potential_amount || ""}
                onChange={e => set("amount", Number(e.target.value))} />
            </label>
            <label className="form-label">Ожидаемая дата оплаты
              <input className="form-input" type="date"
                onChange={e => set("expected_payment_date", e.target.value)} />
            </label>
            <label className="form-label">Кто дожимает
              <select className="form-input" onChange={e => set("responsible_id", Number(e.target.value))}>
                <option value="">— выбрать —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </>
        )}

        {kind === "won" && (
          <>
            <label className="form-label">Фактическая сумма оплаты <span style={{ color: "var(--red)" }}>*</span>
              <input className="form-input" type="number" min={0} required
                defaultValue={card.active_deal?.amount || card.potential_amount || ""}
                onChange={e => set("paid_amount", Number(e.target.value))} />
            </label>
            <label className="form-label">Дата оплаты <span style={{ color: "var(--red)" }}>*</span>
              <input className="form-input" type="date" required
                onChange={e => set("payment_date", e.target.value)} />
            </label>
            <label className="form-label">Способ оплаты
              <select className="form-input" onChange={e => set("payment_method", e.target.value)}>
                <option value="">— выбрать —</option>
                {["Наличные", "Перевод", "Карта", "Расчётный счёт", "Другое"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="form-label">Сеттер
              <select className="form-input" onChange={e => set("setter_id", Number(e.target.value))}>
                <option value="">— выбрать —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="form-label">Клоузер
              <select className="form-input" onChange={e => set("closer_id", Number(e.target.value))}>
                <option value="">— выбрать —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 2 }}>Тип сделки</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { val: "from_setter", label: "От сеттера" },
                { val: "closer_self", label: "Самостоятельная клоузера" },
              ].map(opt => (
                <label key={opt.val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" name="deal_type" value={opt.val}
                    onChange={() => set("deal_type", opt.val)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </>
        )}

        {kind === "lost" && (
          <>
            <label className="form-label">Причина отказа
              <select className="form-input" onChange={e => set("reject_reason_id", Number(e.target.value))}>
                <option value="">— выбрать —</option>
                {rejectReasons.filter(r => r.is_active).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="form-label">Комментарий
              <textarea className="form-input" rows={3} placeholder="Детали..."
                onChange={e => set("reject_comment", e.target.value)} />
            </label>
            <label className="form-label">Кто закрыл
              <select className="form-input" onChange={e => set("closer_id", Number(e.target.value))}>
                <option value="">— выбрать —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </>
        )}

        <label className="form-label">Комментарий к переходу
          <input className="form-input" type="text" placeholder="Необязательно..."
            value={comment} onChange={e => setComment(e.target.value)} />
        </label>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Отмена</button>
          <button type="submit" className="btn btn-primary">Подтвердить</button>
        </div>
      </form>
    </Modal>
  );
}

// ──────────────────────────── KanbanCard ─────────────────────────

function KanbanCard({ card, stage, onClick }: {
  card: FunnelCard; stage: LeadStage | null; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } =
    useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const hl = cardHighlight(card, stage);
  const borderColor = hl === "red" ? "var(--red)" : hl === "yellow" ? "var(--yellow)" : hl === "green" ? "var(--green)" : "var(--border)";

  const overdue = card.next_action_at ? isOverdue(card.next_action_at) : false;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: "var(--bg2)", border: `1px solid ${borderColor}`, borderRadius: 10, padding: 12, cursor: "grab" }}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 4, lineHeight: 1.4 }}>
        {card.client_name}
      </div>
      {card.company_name && (
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>{card.company_name}</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {card.service && (
          <span style={{ fontSize: 10, padding: "2px 7px", background: "var(--primary-dim)", color: "var(--primary)", borderRadius: 4 }}>
            {card.service.name}
          </span>
        )}
        {card.source && (
          <span style={{ fontSize: 10, padding: "2px 7px", background: "var(--bg3)", color: "var(--text3)", borderRadius: 4 }}>
            {card.source.name}
          </span>
        )}
      </div>

      {(card.active_deal?.amount || card.potential_amount > 0) && (
        <div style={{ fontSize: 12, fontWeight: 600, color: hl === "green" ? "var(--green)" : "var(--text)", marginBottom: 6 }}>
          {fmtMoney(card.active_deal?.amount || card.potential_amount)}
        </div>
      )}

      {card.next_action_type && (
        <div style={{ fontSize: 11, color: overdue ? "var(--red)" : "var(--text3)", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            {overdue ? "warning" : "event"}
          </span>
          {card.next_action_type}{card.next_action_at ? ` · ${fmtDate(card.next_action_at)}` : ""}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {card.setter && <Avatar name={card.setter.name} color={card.setter.avatar_color} size={22} />}
          {card.closer && card.closer.id !== card.setter?.id && (
            <Avatar name={card.closer.name} color={card.closer.avatar_color} size={22} />
          )}
        </div>
        <div style={{ fontSize: 10, color: "var(--text3)" }}>
          {card.days_in_stage > 0 ? `${card.days_in_stage} д` : "сегодня"}
          {hl === "yellow" && (
            <span style={{ color: "var(--yellow)", marginLeft: 3 }}>⚠</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── KanbanColumn ───────────────────────

function KanbanColumn({ stage, cards, onCardClick }: {
  stage: LeadStage;
  cards: FunnelCard[];
  onCardClick: (c: FunnelCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage.id}` });
  const potSum = cards.reduce((s, c) => s + (c.active_deal?.amount || c.potential_amount || 0), 0);

  return (
    <div style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "10px 12px", display: "flex", alignItems: "center", gap: 8,
        background: "var(--bg3)", borderRadius: "10px 10px 0 0",
        borderBottom: `2px solid ${stage.color}`,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text2)", flex: 1 }}>
          {stage.name}
        </span>
        <span style={{
          fontSize: 11, padding: "1px 7px", borderRadius: 10,
          background: "var(--bg2)", color: "var(--text3)", fontFamily: "monospace",
        }}>
          {cards.length}
        </span>
      </div>
      {potSum > 0 && (
        <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--text3)", background: "var(--bg3)", textAlign: "right" }}>
          {fmtMoney(potSum)}
        </div>
      )}
      <div
        ref={setNodeRef}
        style={{
          flex: 1, minHeight: 80, padding: "8px 8px", display: "flex", flexDirection: "column", gap: 8,
          background: isOver ? "var(--primary-dim)" : "var(--bg3)",
          borderRadius: "0 0 10px 10px",
          transition: "background 0.15s",
        }}
      >
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(c => (
            <KanbanCard key={c.id} card={c} stage={stage} onClick={() => onCardClick(c)} />
          ))}
        </SortableContext>
        {isOver && cards.length === 0 && (
          <div style={{ border: "1.5px dashed var(--primary)", borderRadius: 8, padding: 18, textAlign: "center", fontSize: 12, color: "var(--primary)" }}>
            Перетащите сюда
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────── KPI Card ───────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "16px 20px", minWidth: 140 }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ──────────────────────────── Main Page ──────────────────────────

export default function FunnelPage() {
  const router = useRouter();
  const showToast = useToast();

  const [data, setData] = useState<FunnelResponse | null>(null);
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rejectReasons, setRejectReasons] = useState<RejectReason[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSetter, setFilterSetter] = useState<number | undefined>();
  const [filterCloser, setFilterCloser] = useState<number | undefined>();

  // drag state
  const [activeCard, setActiveCard] = useState<FunnelCard | null>(null);
  const [cards, setCards] = useState<FunnelCard[]>([]);

  // transition modal
  const [pendingDrop, setPendingDrop] = useState<{ card: FunnelCard; stage: LeadStage; prevCards: FunnelCard[] } | null>(null);

  const filters = { date_from: dateFrom || undefined, date_to: dateTo || undefined, setter_id: filterSetter, closer_id: filterCloser };

  const load = useCallback(async () => {
    try {
      const [funnelData, funnelStats, usersData, rr] = await Promise.all([
        leadApi.funnel(filters),
        leadApi.funnelStats(filters),
        api.listUsers(),
        settingsApi.listRejectReasons(),
      ]);
      setData(funnelData);
      setCards(funnelData.leads);
      setStats(funnelStats);
      setUsers(usersData);
      setRejectReasons(rr);
    } catch (e: any) {
      showToast(e.message || "Ошибка загрузки", "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, filterSetter, filterCloser]);

  useEffect(() => { load(); }, [load]);

  // Sync cards when data reloads (not while dragging)
  const isDragging = activeCard !== null;
  if (!isDragging && data) {
    const a = data.leads.map(c => `${c.id}:${c.stage_id}`).join();
    const b = cards.map(c => `${c.id}:${c.stage_id}`).join();
    if (a !== b) setCards(data.leads);
  }

  const stages = data?.stages || [];
  const stageMap = Object.fromEntries(stages.map(s => [s.id, s]));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(e: DragStartEvent) {
    const card = cards.find(c => c.id === Number(e.active.id));
    if (card) setActiveCard(card);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;

    const cardId = Number(active.id);
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Determine target stage
    let newStageId: number;
    const overId = String(over.id);
    if (overId.startsWith("col-")) {
      newStageId = Number(overId.slice(4));
    } else {
      // dropped on another card
      const overCard = cards.find(c => c.id === Number(over.id));
      if (!overCard || !overCard.stage_id) return;
      newStageId = overCard.stage_id;
    }

    if (!newStageId || newStageId === card.stage_id) return;

    const targetStage = stageMap[newStageId];
    if (!targetStage) return;

    const kind = stageKind(targetStage);
    const prevCards = [...cards];

    // Optimistic update
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, stage_id: newStageId } : c));

    if (kind === "generic") {
      // No modal needed — submit directly
      leadApi.changeStage(cardId, newStageId).then(() => {
        load();
      }).catch((err: any) => {
        setCards(prevCards);
        showToast(err.message || "Ошибка смены этапа", "error");
      });
    } else {
      // Show modal; wait for user confirmation
      setPendingDrop({ card, stage: targetStage, prevCards });
    }
  }

  async function handleTransitionConfirm(comment: string, extra: Record<string, any>) {
    if (!pendingDrop) return;
    const { card, stage, prevCards } = pendingDrop;
    setPendingDrop(null);
    try {
      await leadApi.changeStage(card.id, stage.id, comment, extra);
      if (stage.is_won) {
        showToast("Сделка закрыта! Данные сохранены. Автоматика — в Сессии 3.", "success");
      } else {
        showToast(`Этап изменён на «${stage.name}»`, "success");
      }
      load();
    } catch (err: any) {
      setCards(prevCards);
      showToast(err.message || "Ошибка смены этапа", "error");
    }
  }

  function handleTransitionCancel() {
    if (pendingDrop) {
      setCards(pendingDrop.prevCards);
      setPendingDrop(null);
    }
  }

  if (loading) {
    return (
      <Shell title="Воронка продаж">
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Загрузка...</div>
      </Shell>
    );
  }

  return (
    <Shell title="Воронка продаж">
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-h1">Воронка продаж</div>
          <div className="page-desc">Kanban-доска по этапам</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <input className="form-input" type="date" style={{ width: 150 }}
          value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          placeholder="Дата от" />
        <input className="form-input" type="date" style={{ width: 150 }}
          value={dateTo} onChange={e => setDateTo(e.target.value)}
          placeholder="Дата до" />
        <select className="form-input" style={{ width: 160 }}
          value={filterSetter || ""} onChange={e => setFilterSetter(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Все сеттеры</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="form-input" style={{ width: 160 }}
          value={filterCloser || ""} onChange={e => setFilterCloser(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Все клоузеры</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* KPI */}
      {stats && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <KpiCard label="Новых лидов" value={stats.new_leads} />
          <KpiCard label="На встрече" value={stats.meetings_stage} color="var(--primary)" />
          <KpiCard label="Договоров" value={stats.contracts_sent} />
          <KpiCard label="Ожид. оплату" value={stats.waiting_payment} color="var(--yellow)" />
          <KpiCard label="Закрыто" value={stats.closed_won} color="var(--green)" />
          <KpiCard label="Конверсия" value={`${stats.conversion_pct}%`} color="var(--primary)" />
          <KpiCard label="Потенциал" value={fmtMoney(stats.potential_sum)} />
        </div>
      )}

      {/* Kanban */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ overflowX: "auto", paddingBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, minWidth: "max-content", alignItems: "flex-start" }}>
            {stages.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                cards={cards.filter(c => c.stage_id === stage.id)}
                onCardClick={c => router.push(`/leads/${c.id}`)}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--primary)", borderRadius: 10,
              padding: 12, width: 260, boxShadow: "var(--shadow-md)", cursor: "grabbing",
            }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{activeCard.client_name}</div>
              {activeCard.potential_amount > 0 && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{fmtMoney(activeCard.potential_amount)}</div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Transition modal */}
      {pendingDrop && (
        <TransitionModal
          stage={pendingDrop.stage}
          card={pendingDrop.card}
          users={users}
          rejectReasons={rejectReasons}
          onConfirm={handleTransitionConfirm}
          onCancel={handleTransitionCancel}
        />
      )}

      <style jsx global>{`
        .form-label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--text2); font-weight: 500; }
        .form-input { background: var(--bg3); border: 1px solid var(--border); border-radius: 7px; padding: 8px 10px; font-size: 13px; color: var(--text); font-family: inherit; outline: none; transition: border-color 0.15s; }
        .form-input:focus { border-color: var(--primary); }
        .btn { padding: 8px 16px; border-radius: 7px; font-size: 13px; font-family: inherit; cursor: pointer; border: none; font-weight: 500; transition: all 0.13s; }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-primary:hover { opacity: 0.88; }
        .btn-ghost { background: var(--bg3); color: var(--text2); border: 1px solid var(--border); }
        .btn-ghost:hover { background: var(--bg2); }
      `}</style>
    </Shell>
  );
}
