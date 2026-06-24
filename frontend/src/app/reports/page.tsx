"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { useToast } from "@/context/ToastContext";
import { analyticsApi } from "@/lib/api";

type ExportType = "leads" | "finance" | "payroll";

function ExportCard({
  type, label, desc, icon,
}: {
  type: ExportType; label: string; desc: string; icon: string;
}) {
  const showToast = useToast();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const doExport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      await analyticsApi.exportXlsx(type, params);
      showToast("Файл скачан", "success");
    } catch (e: any) {
      showToast(e.message || "Ошибка экспорта", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--accent)" }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>{desc}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>С</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 148 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>По</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 148 }} />
        </div>
        {(dateFrom || dateTo) && (
          <button className="btn-ghost" style={{ alignSelf: "flex-end" }} onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Сброс
          </button>
        )}
      </div>
      <button className="btn-primary" onClick={doExport} disabled={loading} style={{ alignSelf: "flex-start" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>download</span>
        {loading ? "Экспортируем..." : "Скачать .xlsx"}
      </button>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Shell title="Отчёты">
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-h1">Отчёты</div>
          <div className="page-desc">Экспорт данных в Excel</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900 }}>
        <ExportCard
          type="leads"
          label="Лиды"
          desc="Список лидов с фильтрацией по периоду — клиент, источник, этап, суммы, ответственные."
          icon="person_search"
        />
        <ExportCard
          type="finance"
          label="Финансы"
          desc="Все финансовые транзакции за период — доходы и расходы с категориями."
          icon="account_balance_wallet"
        />
        <ExportCard
          type="payroll"
          label="Зарплаты"
          desc="Расчётные листы сотрудников — оклад, комиссия, бонусы, итого."
          icon="payments"
        />
      </div>
    </Shell>
  );
}
