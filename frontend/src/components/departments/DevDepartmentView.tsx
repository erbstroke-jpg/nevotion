"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BoardView } from "@/components/BoardView";
import { UserModal } from "@/components/UserModal";
import { ServerModal } from "@/components/ServerModal";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import {
  Department, UserWithStats, Server, Board, STATUS_LABELS, ServerStatus,
} from "@/lib/types";

export function DevDepartmentView({ dept, departments }: { dept: Department; departments: Department[] }) {
  const { isAdmin, user: currentUser } = useApp();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [backendBoard, setBackendBoard] = useState<Board | null>(null);
  const [userModal, setUserModal] = useState(false);
  const [serverModal, setServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [prompterFilter, setPrompterFilter] = useState<number | null>(null);

  const load = useCallback(() => {
    api.listUsers(dept.id).then(setUsers).catch(() => {});
    api.listServers().then(setServers).catch(() => {});
    api.boardsForDepartment(dept.id).then((bs) => setBackendBoard(bs.find((b) => b.kind === "backend_queue") ?? null)).catch(() => {});
  }, [dept.id]);

  useEffect(() => { load(); }, [load]);

  const backend = users.filter((u) => u.position === "Бэкенд" || u.position === "Главный тех лид");
  const prompters = users.filter((u) => u.position === "Промпт-инженер" || u.position === "Тимлид");

  const filteredServers = prompterFilter ? servers.filter((sv) => sv.owner_id === prompterFilter) : servers;

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="page-h1">Отдел разработки</div>
          <div className="page-desc">Команда, боты и очередь задач</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setUserModal(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span> Сотрудник
          </button>
        )}
      </div>

      {/* Backend team */}
      <SectionLabel>Backend-команда</SectionLabel>
      <div className="backend-row">
        {backend.map((u) => (
          <div key={u.id} className="backend-card card" onClick={() => router.push(`/team/${u.id}`)}>
            <div style={{ position: "relative" }}>
              <Avatar name={u.name} color={u.avatar_color} size={42} />
              <span className="sdot" style={{ background: u.is_online ? "var(--green)" : "var(--text3)" }} />
            </div>
            <div>
              <div className="bc-name">{u.name}</div>
              <div className="bc-role">{u.position}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Prompt engineers */}
      <SectionLabel style={{ marginTop: 34 }}>Промпт-инженеры</SectionLabel>
      <div className="prompters-grid">
        {prompters.map((u) => (
          <div key={u.id} className="prompter-card card" onClick={() => router.push(`/team/${u.id}`)}>
            <div className="pc-head">
              <Avatar name={u.name} color={u.avatar_color} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pc-name">{u.name}{u.position === "Тимлид" && <span className="pill">Тимлид</span>}</div>
                <div className="pc-role">{u.position}</div>
              </div>
              <span className="sdot-inline" style={{ background: u.is_online ? "var(--green)" : "var(--text3)" }} />
            </div>
            <div className="pc-divider" />
            <div className="pc-stats">
              <Stat v={u.total_bots} l="Всего ботов" />
              <Stat v={u.new_bots} l="Новых" c="var(--primary)" />
              <Stat v={u.support_bots} l="Тех" c="var(--orange)" />
            </div>
          </div>
        ))}
      </div>

      {/* Server List */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 34, marginBottom: 14 }}>
        <SectionLabel style={{ margin: 0 }}>Server List (WhatsApp)</SectionLabel>
        <button className="btn btn-ghost" onClick={() => { setEditingServer(null); setServerModal(true); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Добавить бота
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div className={`chip ${prompterFilter === null ? "active" : ""}`} onClick={() => setPrompterFilter(null)}>Все ({servers.length})</div>
        {[...users.filter((u) => u.position === "Промпт-инженер" || u.position === "Тимлид")].map((u) => {
          const cnt = servers.filter((sv) => sv.owner_id === u.id).length;
          return <div key={u.id} className={`chip ${prompterFilter === u.id ? "active" : ""}`} onClick={() => setPrompterFilter(u.id === prompterFilter ? null : u.id)}>{u.name} ({cnt})</div>;
        })}
      </div>
      <div className="card" style={{ overflow: "hidden" }}><div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr><th>Компания</th><th>Статус</th><th>Дата подключения</th><th>Промптер</th><th></th></tr>
          </thead>
          <tbody>
            {filteredServers.map((s) => (
              <tr key={s.id}>
                <td style={{ color: "var(--text)", fontWeight: 500 }}>{s.company}</td>
                <td><StatusBadge status={s.status} /></td>
                <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>{fmtDate(s.connected_at)}</td>
                <td>{s.owner ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Avatar name={s.owner.name} color={s.owner.avatar_color} size={22} /> {s.owner.name}
                  </span>) : <span style={{ color: "var(--text3)" }}>—</span>}
                </td>
                {(isAdmin || s.owner_id === currentUser?.id) && (
                  <td style={{ width: 70 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="row-act" onClick={() => { setEditingServer(s); setServerModal(true); }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span>
                      </button>
                      {isAdmin && (
                        <button className="row-act" onClick={async () => { if (confirm(`Удалить «${s.company}»?`)) { await api.deleteServer(s.id); load(); } }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Backend queue */}
      <SectionLabel style={{ marginTop: 34 }}>Очередь задач бэкенда</SectionLabel>
      <div className="page-desc" style={{ marginBottom: 16 }}>Промптеры ставят задачи бэкендерам · колонки и карточки редактируемы</div>
      {backendBoard && <BoardView boardId={backendBoard.id} />}

      </div>
      <UserModal open={userModal} onClose={() => setUserModal(false)} onSaved={load} user={null} departments={departments} defaultDeptId={dept.id} />
      <ServerModal open={serverModal} onClose={() => setServerModal(false)} onSaved={load} server={editingServer} users={users} />

      <style jsx global>{`
        .backend-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .backend-card { display: flex; align-items: center; gap: 14px; padding: 16px; cursor: pointer; }
        .backend-card:hover { border-color: var(--border2); box-shadow: var(--shadow); }
        .bc-name { font-size: 14px; font-weight: 600; color: var(--text); }
        .bc-role { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
        .sdot { position: absolute; bottom: 0; right: 0; width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--bg2); }
        .sdot-inline { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .prompters-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .prompter-card { padding: 20px; cursor: pointer; }
        .prompter-card:hover { border-color: var(--primary); box-shadow: var(--shadow); }
        .pc-head { display: flex; align-items: center; gap: 12px; }
        .pc-name { font-size: 15px; font-weight: 600; color: var(--text); display: flex; align-items: center; }
        .pc-role { font-size: 12px; color: var(--text3); margin-top: 2px; }
        .pill { font-size: 9px; padding: 2px 7px; border-radius: 10px; background: var(--primary-dim); color: var(--primary); font-weight: 600; margin-left: 8px; }
        .pc-divider { height: 1px; background: var(--border); margin: 16px 0; }
        .pc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .pc-val { font-size: 22px; font-weight: 700; font-family: "JetBrains Mono", monospace; color: var(--text); line-height: 1; }
        .pc-lbl { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 5px; }
        .chip { padding: 6px 13px; border-radius: 20px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg2); color: var(--text2); transition: all 0.13s; }
        .chip:hover { border-color: var(--primary); color: var(--primary); }
        .chip.active { background: var(--primary-dim); border-color: var(--primary); color: var(--primary); font-weight: 500; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table thead { background: var(--bg3); }
        .data-table th { padding: 11px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text3); border-bottom: 1px solid var(--border); }
        .data-table td { padding: 13px 16px; font-size: 13px; border-bottom: 1px solid var(--border); color: var(--text2); }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tbody tr:hover td { background: var(--bg-hover); }
        .row-act { width: 28px; height: 28px; border: none; background: transparent; color: var(--text3); border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .row-act:hover { background: var(--bg3); color: var(--text); }
        .section-label { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); margin-bottom: 14px; }
      `}</style>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="section-label" style={style}>{children}</div>;
}
function Stat({ v, l, c }: { v: number; l: string; c?: string }) {
  return <div><div className="pc-val" style={{ color: c }}>{v}</div><div className="pc-lbl">{l}</div></div>;
}
function StatusBadge({ status }: { status: ServerStatus }) {
  const isNew = status === "new";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600,
      background: isNew ? "var(--primary-dim)" : "var(--orange-bg)", color: isNew ? "var(--primary)" : "var(--orange)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
      {STATUS_LABELS[status]}
    </span>
  );
}
