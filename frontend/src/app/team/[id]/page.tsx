"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Avatar } from "@/components/Avatar";
import { BoardView } from "@/components/BoardView";
import { api } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { UserWithStats, Board, Server, BotColor } from "@/lib/types";
import { BOT_COLORS, BOT_SUB_STATUSES, STATUS_LABELS } from "@/lib/types";

const COLOR_OPTIONS: BotColor[] = ["green", "yellow", "blue", "red"];

export default function TrackerPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const userId = Number(params.id);
  const [member, setMember] = useState<UserWithStats | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [bots, setBots] = useState<Server[]>([]);

  const isPrompter = member?.position === "Промпт-инженер" || member?.position === "Тимлид";

  const loadBots = useCallback(() => {
    if (isPrompter) {
      api.listServers({ owner_id: userId }).then(setBots).catch(() => {});
    }
  }, [userId, isPrompter]);

  useEffect(() => {
    api.getUser(userId).then(setMember).catch(() => {});
    api.getPersonalBoard(userId).then(setBoard).catch(() => {});
  }, [userId]);

  useEffect(() => { loadBots(); }, [loadBots]);

  async function updateBot(id: number, patch: any) {
    try {
      await api.updateServer(id, patch);
      loadBots();
    } catch (e: any) { toast(e.message, "error"); }
  }

  const salary = bots.reduce((s, b) => s + (b.price || (b.status === "support" ? 1000 : 0)), 0);

  return (
    <Shell title={member ? `Трекер: ${member.name}` : "Трекер"}>
      <div onClick={() => router.back()}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text2)", cursor: "pointer", marginBottom: 18 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Назад
      </div>

      {member && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <Avatar name={member.name} color={member.avatar_color} size={52} />
          <div style={{ flex: 1 }}>
            <div className="page-h1" style={{ display: "flex", alignItems: "center" }}>
              {member.name}
              {member.position === "Тимлид" && (
                <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, background: "var(--primary-dim)", color: "var(--primary)", fontWeight: 600, marginLeft: 10 }}>Тимлид</span>
              )}
              {member.is_founder && (
                <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, background: "var(--green-bg)", color: "var(--green)", fontWeight: 600, marginLeft: 8 }}>Основатель</span>
              )}
            </div>
            <div className="page-desc">{member.position} · {member.total_bots} ботов · личные задачи</div>
          </div>
          {isPrompter && salary > 0 && (
            <div style={{ padding: "10px 18px", background: "var(--bg2)", borderRadius: 10, border: "1px solid var(--border)", textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 3 }}>Зарплата</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", fontFamily: "JetBrains Mono, monospace" }}>
                {salary.toLocaleString("ru-RU")} сом
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bots section for prompters */}
      {isPrompter && bots.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)", marginBottom: 14 }}>
            Боты ({bots.length})
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg3)" }}>
                    <th style={thStyle}>Цвет</th>
                    <th style={thStyle}>Компания</th>
                    <th style={thStyle}>Статус</th>
                    <th style={thStyle}>Подстатус</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Цена</th>
                    <th style={thStyle}>Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((bot) => {
                    const col = BOT_COLORS[bot.color as BotColor] ?? BOT_COLORS.green;
                    return (
                      <tr key={bot.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        {/* Color picker inline */}
                        <td style={{ padding: "10px 14px", width: 120 }}>
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {COLOR_OPTIONS.map((c) => {
                              const cc = BOT_COLORS[c];
                              return (
                                <button key={c} title={cc.label}
                                  onClick={() => updateBot(bot.id, { color: c })}
                                  style={{
                                    width: 16, height: 16, borderRadius: "50%",
                                    background: cc.color, border: bot.color === c ? `2px solid ${cc.color}` : "2px solid transparent",
                                    outline: bot.color === c ? `2px solid ${cc.bg}` : "none",
                                    cursor: "pointer", padding: 0, transition: "all 0.12s",
                                  }} />
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--text)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                            {bot.company}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600,
                            background: bot.status === "new" ? "var(--primary-dim)" : "var(--orange-bg)",
                            color: bot.status === "new" ? "var(--primary)" : "var(--orange)",
                          }}>{STATUS_LABELS[bot.status]}</span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {bot.status === "new" ? (
                            <select
                              value={bot.sub_status ?? ""}
                              onChange={(e) => updateBot(bot.id, { sub_status: e.target.value || null })}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                border: "1px solid var(--border)", background: "var(--bg2)", borderRadius: 6,
                                padding: "4px 8px", fontSize: 12, color: "var(--text2)", fontFamily: "inherit", cursor: "pointer",
                              }}>
                              <option value="">—</option>
                              {BOT_SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : <span style={{ color: "var(--text3)" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                          {bot.price > 0 ? bot.price.toLocaleString("ru-RU") : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 200 }}>
                          <input
                            defaultValue={bot.bot_comment}
                            placeholder="Комментарий..."
                            onBlur={(e) => {
                              if (e.target.value !== bot.bot_comment)
                                updateBot(bot.id, { bot_comment: e.target.value });
                            }}
                            style={{
                              width: "100%", border: "1px solid transparent", background: "transparent",
                              borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "var(--text2)",
                              fontFamily: "inherit", outline: "none",
                            }}
                            onFocus={(e) => { e.target.style.borderColor = "var(--border2)"; e.target.style.background = "var(--bg2)"; }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {board && <BoardView boardId={board.id} lockOwnerId={userId} />}
    </Shell>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontSize: 11,
  fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text3)", borderBottom: "1px solid var(--border)",
};
