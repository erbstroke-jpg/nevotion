"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useApp } from "@/context/AppContext";
import { settingsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { LeadSource, ServiceItem, LeadStage, RejectReason, ExpenseCategory, Account } from "@/lib/types";

type Tab = "sources" | "services" | "stages" | "reject" | "expense" | "accounts";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "sources",  label: "Источники",          icon: "share" },
  { key: "services", label: "Услуги",              icon: "design_services" },
  { key: "stages",   label: "Этапы воронки",       icon: "filter_alt" },
  { key: "reject",   label: "Причины отказа",      icon: "cancel" },
  { key: "expense",  label: "Статьи расходов",     icon: "receipt_long" },
  { key: "accounts", label: "Счета",               icon: "account_balance_wallet" },
];

// ── Generic lookup list (name + is_active) ──────────────────────

function LookupSection({
  items,
  onAdd,
  onRename,
  onToggle,
  onMoveUp,
  onMoveDown,
  extraCols,
}: {
  items: any[];
  onAdd: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onToggle: (id: number, is_active: boolean) => Promise<void>;
  onMoveUp: (id: number) => Promise<void>;
  onMoveDown: (id: number) => Promise<void>;
  extraCols?: (item: any) => React.ReactNode;
}) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    try { await onAdd(newName.trim()); setNewName(""); } finally { setBusy(false); }
  }

  async function handleRename(id: number) {
    if (!editName.trim()) return;
    setBusy(true);
    try { await onRename(id, editName.trim()); setEditId(null); } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input
          className="sett-input"
          placeholder="Новый пункт…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button className="btn btn-primary" onClick={handleAdd} disabled={busy || !newName.trim()}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Добавить
        </button>
      </div>

      <div className="sett-list">
        {items.map((item, idx) => (
          <div key={item.id} className={`sett-row ${!item.is_active ? "sett-row-inactive" : ""}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="sett-reorder-btn" onClick={() => onMoveUp(item.id)} disabled={idx === 0}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_upward</span>
              </button>
              <button className="sett-reorder-btn" onClick={() => onMoveDown(item.id)} disabled={idx === items.length - 1}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_downward</span>
              </button>
            </div>

            {editId === item.id ? (
              <input
                className="sett-input sett-inline-input"
                value={editName}
                autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(item.id);
                  if (e.key === "Escape") setEditId(null);
                }}
                onBlur={() => handleRename(item.id)}
              />
            ) : (
              <span
                className="sett-name"
                onClick={() => { setEditId(item.id); setEditName(item.name); }}
                title="Нажмите для переименования"
              >
                {item.name}
              </span>
            )}

            {extraCols && extraCols(item)}

            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {"is_active" in item && (
                <button
                  className={`sett-toggle ${item.is_active ? "sett-toggle-on" : "sett-toggle-off"}`}
                  onClick={() => onToggle(item.id, !item.is_active)}
                  title={item.is_active ? "Отключить" : "Включить"}
                >
                  {item.is_active ? "Активен" : "Отключён"}
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Список пуст</div>
        )}
      </div>
    </div>
  );
}

// ── Stages section (extra fields) ───────────────────────────────

function StagesSection({
  stages,
  onAdd,
  onUpdate,
  onMoveUp,
  onMoveDown,
}: {
  stages: LeadStage[];
  onAdd: (data: any) => Promise<void>;
  onUpdate: (id: number, data: any) => Promise<void>;
  onMoveUp: (id: number) => Promise<void>;
  onMoveDown: (id: number) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<LeadStage>>({});
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    try { await onAdd({ name: newName.trim() }); setNewName(""); } finally { setBusy(false); }
  }

  async function handleSave(id: number) {
    setBusy(true);
    try { await onUpdate(id, editData); setEditId(null); setEditData({}); } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input
          className="sett-input"
          placeholder="Новый этап…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button className="btn btn-primary" onClick={handleAdd} disabled={busy || !newName.trim()}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Добавить
        </button>
      </div>

      <div className="sett-list">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="sett-row">
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="sett-reorder-btn" onClick={() => onMoveUp(stage.id)} disabled={idx === 0}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_upward</span>
              </button>
              <button className="sett-reorder-btn" onClick={() => onMoveDown(stage.id)} disabled={idx === stages.length - 1}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_downward</span>
              </button>
            </div>

            <div
              className="stage-color-dot"
              style={{ background: stage.color, flexShrink: 0 }}
            />

            {editId === stage.id ? (
              <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="sett-input sett-inline-input"
                  style={{ minWidth: 140 }}
                  value={editData.name ?? stage.name}
                  autoFocus
                  onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                />
                <label style={{ fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 4 }}>
                  Цвет
                  <input
                    type="color"
                    value={editData.color ?? stage.color}
                    onChange={(e) => setEditData((d) => ({ ...d, color: e.target.value }))}
                    style={{ width: 28, height: 28, border: "none", background: "none", cursor: "pointer" }}
                  />
                </label>
                <label style={{ fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 4 }}>
                  Норма дней
                  <input
                    type="number"
                    className="sett-input"
                    style={{ width: 64 }}
                    value={editData.norm_days ?? stage.norm_days ?? ""}
                    onChange={(e) => setEditData((d) => ({ ...d, norm_days: e.target.value ? Number(e.target.value) : null }))}
                  />
                </label>
                <label style={{ fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={editData.is_won ?? stage.is_won}
                    onChange={(e) => setEditData((d) => ({ ...d, is_won: e.target.checked }))} />
                  Оплачено
                </label>
                <label style={{ fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={editData.is_lost ?? stage.is_lost}
                    onChange={(e) => setEditData((d) => ({ ...d, is_lost: e.target.checked }))} />
                  Минус
                </label>
                <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleSave(stage.id)} disabled={busy}>Сохранить</button>
                <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { setEditId(null); setEditData({}); }}>Отмена</button>
              </div>
            ) : (
              <>
                <span className="sett-name" onClick={() => { setEditId(stage.id); setEditData({}); }} title="Редактировать">
                  {stage.name}
                </span>
                {stage.norm_days != null && (
                  <span className="sett-badge" style={{ background: "var(--bg3)", color: "var(--text3)" }}>{stage.norm_days}д</span>
                )}
                {stage.is_won && <span className="sett-badge" style={{ background: "var(--green-bg)", color: "var(--green)" }}>Оплачено</span>}
                {stage.is_lost && <span className="sett-badge" style={{ background: "var(--red-bg)", color: "var(--red)" }}>Минус</span>}
              </>
            )}
          </div>
        ))}
        {stages.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Список пуст</div>
        )}
      </div>
    </div>
  );
}

// ── Accounts section ─────────────────────────────────────────────

function AccountsSection({
  accounts,
  onAdd,
  onUpdate,
  onMoveUp,
  onMoveDown,
}: {
  accounts: Account[];
  onAdd: (data: any) => Promise<void>;
  onUpdate: (id: number, data: any) => Promise<void>;
  onMoveUp: (id: number) => Promise<void>;
  onMoveDown: (id: number) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("сом");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCurrency, setEditCurrency] = useState("сом");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    try { await onAdd({ name: newName.trim(), currency: newCurrency }); setNewName(""); setNewCurrency("сом"); } finally { setBusy(false); }
  }

  async function handleSave(id: number) {
    setBusy(true);
    try { await onUpdate(id, { name: editName, currency: editCurrency }); setEditId(null); } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="sett-input" placeholder="Название счёта…" value={newName}
          onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
        <input className="sett-input" style={{ width: 80 }} placeholder="Валюта" value={newCurrency}
          onChange={(e) => setNewCurrency(e.target.value)} />
        <button className="btn btn-primary" onClick={handleAdd} disabled={busy || !newName.trim()}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Добавить
        </button>
      </div>

      <div className="sett-list">
        {accounts.map((acc, idx) => (
          <div key={acc.id} className={`sett-row ${!acc.is_active ? "sett-row-inactive" : ""}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="sett-reorder-btn" onClick={() => onMoveUp(acc.id)} disabled={idx === 0}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_upward</span>
              </button>
              <button className="sett-reorder-btn" onClick={() => onMoveDown(acc.id)} disabled={idx === accounts.length - 1}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_downward</span>
              </button>
            </div>

            {editId === acc.id ? (
              <div style={{ display: "flex", gap: 8, flex: 1, alignItems: "center" }}>
                <input className="sett-input sett-inline-input" value={editName} autoFocus
                  onChange={(e) => setEditName(e.target.value)} />
                <input className="sett-input" style={{ width: 80 }} value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)} />
                <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleSave(acc.id)}>Сохранить</button>
                <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEditId(null)}>Отмена</button>
              </div>
            ) : (
              <>
                <span className="sett-name" onClick={() => { setEditId(acc.id); setEditName(acc.name); setEditCurrency(acc.currency); }}>
                  {acc.name}
                </span>
                <span className="sett-badge" style={{ background: "var(--bg3)", color: "var(--text3)" }}>{acc.currency}</span>
              </>
            )}

            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                className={`sett-toggle ${acc.is_active ? "sett-toggle-on" : "sett-toggle-off"}`}
                onClick={() => onUpdate(acc.id, { is_active: !acc.is_active })}
              >
                {acc.is_active ? "Активен" : "Отключён"}
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Список пуст</div>
        )}
      </div>
    </div>
  );
}


// ── Main page ────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAdmin } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("sources");

  const [sources, setSources] = useState<LeadSource[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [rejectReasons, setRejectReasons] = useState<RejectReason[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!isAdmin) { router.push("/dashboard"); return; }
    loadAll();
  }, [isAdmin]);

  async function loadAll() {
    const [s, sv, st, rr, ec, ac] = await Promise.all([
      settingsApi.listSources().catch(() => []),
      settingsApi.listServices().catch(() => []),
      settingsApi.listStages().catch(() => []),
      settingsApi.listRejectReasons().catch(() => []),
      settingsApi.listExpenseCategories().catch(() => []),
      settingsApi.listAccounts().catch(() => []),
    ]);
    setSources(s as LeadSource[]);
    setServices(sv as ServiceItem[]);
    setStages(st as LeadStage[]);
    setRejectReasons(rr as RejectReason[]);
    setExpenseCategories(ec as ExpenseCategory[]);
    setAccounts(ac as Account[]);
  }

  async function wrap(fn: () => Promise<void>, reload: () => Promise<void>) {
    try { await fn(); await reload(); toast("Сохранено", "success"); }
    catch (e: any) { toast(e.message || "Ошибка", "error"); }
  }

  // Sources
  const loadSources = async () => setSources(await settingsApi.listSources());
  const srcHandlers = {
    onAdd: (name: string) => wrap(() => settingsApi.createSource(name).then(), loadSources),
    onRename: (id: number, name: string) => wrap(() => settingsApi.updateSource(id, { name }).then(), loadSources),
    onToggle: (id: number, is_active: boolean) => wrap(() => settingsApi.updateSource(id, { is_active }).then(), loadSources),
    onMoveUp: (id: number) => {
      const idx = sources.findIndex((s) => s.id === id);
      if (idx <= 0) return Promise.resolve();
      return wrap(() => settingsApi.reorderSource(id, idx - 1).then((r) => setSources(r as LeadSource[])), async () => {});
    },
    onMoveDown: (id: number) => {
      const idx = sources.findIndex((s) => s.id === id);
      if (idx >= sources.length - 1) return Promise.resolve();
      return wrap(() => settingsApi.reorderSource(id, idx + 1).then((r) => setSources(r as LeadSource[])), async () => {});
    },
  };

  // Services
  const loadServices = async () => setServices(await settingsApi.listServices());
  const svcHandlers = {
    onAdd: (name: string) => wrap(() => settingsApi.createService(name).then(), loadServices),
    onRename: (id: number, name: string) => wrap(() => settingsApi.updateService(id, { name }).then(), loadServices),
    onToggle: (id: number, is_active: boolean) => wrap(() => settingsApi.updateService(id, { is_active }).then(), loadServices),
    onMoveUp: (id: number) => {
      const idx = services.findIndex((s) => s.id === id);
      if (idx <= 0) return Promise.resolve();
      return wrap(() => settingsApi.reorderService(id, idx - 1).then((r) => setServices(r as ServiceItem[])), async () => {});
    },
    onMoveDown: (id: number) => {
      const idx = services.findIndex((s) => s.id === id);
      if (idx >= services.length - 1) return Promise.resolve();
      return wrap(() => settingsApi.reorderService(id, idx + 1).then((r) => setServices(r as ServiceItem[])), async () => {});
    },
  };

  // Stages
  const loadStages = async () => setStages(await settingsApi.listStages());
  const stageHandlers = {
    onAdd: (data: any) => wrap(() => settingsApi.createStage(data).then(), loadStages),
    onUpdate: (id: number, data: any) => wrap(() => settingsApi.updateStage(id, data).then(), loadStages),
    onMoveUp: (id: number) => {
      const idx = stages.findIndex((s) => s.id === id);
      if (idx <= 0) return Promise.resolve();
      return wrap(() => settingsApi.reorderStage(id, idx - 1).then((r) => setStages(r as LeadStage[])), async () => {});
    },
    onMoveDown: (id: number) => {
      const idx = stages.findIndex((s) => s.id === id);
      if (idx >= stages.length - 1) return Promise.resolve();
      return wrap(() => settingsApi.reorderStage(id, idx + 1).then((r) => setStages(r as LeadStage[])), async () => {});
    },
  };

  // Reject reasons
  const loadReject = async () => setRejectReasons(await settingsApi.listRejectReasons());
  const rejectHandlers = {
    onAdd: (name: string) => wrap(() => settingsApi.createRejectReason(name).then(), loadReject),
    onRename: (id: number, name: string) => wrap(() => settingsApi.updateRejectReason(id, { name }).then(), loadReject),
    onToggle: (id: number, is_active: boolean) => wrap(() => settingsApi.updateRejectReason(id, { is_active }).then(), loadReject),
    onMoveUp: (id: number) => {
      const idx = rejectReasons.findIndex((r) => r.id === id);
      if (idx <= 0) return Promise.resolve();
      return wrap(() => settingsApi.reorderRejectReason(id, idx - 1).then((r) => setRejectReasons(r as RejectReason[])), async () => {});
    },
    onMoveDown: (id: number) => {
      const idx = rejectReasons.findIndex((r) => r.id === id);
      if (idx >= rejectReasons.length - 1) return Promise.resolve();
      return wrap(() => settingsApi.reorderRejectReason(id, idx + 1).then((r) => setRejectReasons(r as RejectReason[])), async () => {});
    },
  };

  // Expense categories
  const loadExpense = async () => setExpenseCategories(await settingsApi.listExpenseCategories());
  const expenseHandlers = {
    onAdd: (name: string) => wrap(() => settingsApi.createExpenseCategory(name).then(), loadExpense),
    onRename: (id: number, name: string) => wrap(() => settingsApi.updateExpenseCategory(id, { name }).then(), loadExpense),
    onToggle: (id: number, is_active: boolean) => wrap(() => settingsApi.updateExpenseCategory(id, { is_active }).then(), loadExpense),
    onMoveUp: (id: number) => {
      const idx = expenseCategories.findIndex((e) => e.id === id);
      if (idx <= 0) return Promise.resolve();
      return wrap(() => settingsApi.reorderExpenseCategory(id, idx - 1).then((r) => setExpenseCategories(r as ExpenseCategory[])), async () => {});
    },
    onMoveDown: (id: number) => {
      const idx = expenseCategories.findIndex((e) => e.id === id);
      if (idx >= expenseCategories.length - 1) return Promise.resolve();
      return wrap(() => settingsApi.reorderExpenseCategory(id, idx + 1).then((r) => setExpenseCategories(r as ExpenseCategory[])), async () => {});
    },
  };

  // Accounts
  const loadAccounts = async () => setAccounts(await settingsApi.listAccounts());
  const accountHandlers = {
    onAdd: (data: any) => wrap(() => settingsApi.createAccount(data).then(), loadAccounts),
    onUpdate: (id: number, data: any) => wrap(() => settingsApi.updateAccount(id, data).then(), loadAccounts),
    onMoveUp: (id: number) => {
      const idx = accounts.findIndex((a) => a.id === id);
      if (idx <= 0) return Promise.resolve();
      return wrap(() => settingsApi.reorderAccount(id, idx - 1).then((r) => setAccounts(r as Account[])), async () => {});
    },
    onMoveDown: (id: number) => {
      const idx = accounts.findIndex((a) => a.id === id);
      if (idx >= accounts.length - 1) return Promise.resolve();
      return wrap(() => settingsApi.reorderAccount(id, idx + 1).then((r) => setAccounts(r as Account[])), async () => {});
    },
  };

  return (
    <Shell title="Настройки">
      <div className="page-head">
        <div className="page-h1">Настройки</div>
        <div className="page-desc">Справочники CRM — редактируйте списки источников, услуг, этапов воронки и счетов</div>
      </div>

      <div className="card">
        {/* Tabs */}
        <div className="sett-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`sett-tab ${tab === t.key ? "sett-tab-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "24px 20px" }}>
          {tab === "sources" && (
            <LookupSection items={sources} {...srcHandlers} />
          )}
          {tab === "services" && (
            <LookupSection items={services} {...svcHandlers} />
          )}
          {tab === "stages" && (
            <StagesSection stages={stages} {...stageHandlers} />
          )}
          {tab === "reject" && (
            <LookupSection items={rejectReasons} {...rejectHandlers} />
          )}
          {tab === "expense" && (
            <LookupSection items={expenseCategories} {...expenseHandlers} />
          )}
          {tab === "accounts" && (
            <AccountsSection accounts={accounts} {...accountHandlers} />
          )}
        </div>
      </div>

      <style jsx>{`
        .sett-tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 12px 12px 0; border-bottom: 1px solid var(--border); }
        .sett-tab { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; background: none; color: var(--text3); font-size: 13px; font-family: inherit; cursor: pointer; border-radius: 6px 6px 0 0; transition: all 0.13s; margin-bottom: -1px; border-bottom: 2px solid transparent; }
        .sett-tab:hover { color: var(--text); background: var(--bg3); }
        .sett-tab-active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 500; }
        .sett-list { display: flex; flex-direction: column; gap: 4px; }
        .sett-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg3); border-radius: 6px; border: 1px solid var(--border); }
        .sett-row-inactive { opacity: 0.55; }
        .sett-name { flex: 1; font-size: 14px; color: var(--text); cursor: pointer; }
        .sett-name:hover { color: var(--primary); }
        .sett-input { background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; font-size: 13px; color: var(--text); font-family: inherit; outline: none; flex: 1; }
        .sett-input:focus { border-color: var(--primary); }
        .sett-inline-input { flex: 1; }
        .sett-reorder-btn { background: none; border: none; cursor: pointer; color: var(--text3); padding: 1px 2px; border-radius: 3px; display: flex; align-items: center; }
        .sett-reorder-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text); }
        .sett-reorder-btn:disabled { opacity: 0.3; cursor: default; }
        .sett-toggle { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: none; cursor: pointer; font-family: inherit; }
        .sett-toggle-on { background: var(--green-bg); color: var(--green); }
        .sett-toggle-off { background: var(--bg3); color: var(--text3); }
        .sett-badge { padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 500; }
        .stage-color-dot { width: 12px; height: 12px; border-radius: 50%; }
      `}</style>
    </Shell>
  );
}
