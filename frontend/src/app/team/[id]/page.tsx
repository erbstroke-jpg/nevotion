"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Avatar } from "@/components/Avatar";
import { BoardView } from "@/components/BoardView";
import { api } from "@/lib/api";
import type { UserWithStats, Board } from "@/lib/types";

export default function TrackerPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);
  const [member, setMember] = useState<UserWithStats | null>(null);
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    api.getUser(userId).then(setMember).catch(() => {});
    api.getPersonalBoard(userId).then(setBoard).catch(() => {});
  }, [userId]);

  return (
    <Shell title={member ? `Трекер: ${member.name}` : "Трекер"}>
      <div onClick={() => router.back()}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text2)", cursor: "pointer", marginBottom: 18 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Назад
      </div>

      {member && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <Avatar name={member.name} color={member.avatar_color} size={52} />
          <div>
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
        </div>
      )}

      {board && <BoardView boardId={board.id} lockOwnerId={userId} />}
    </Shell>
  );
}
