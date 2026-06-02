"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
            <span className="material-symbols-outlined toast-ico">
              {t.kind === "success" ? "check_circle" : t.kind === "error" ? "error" : "info"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
      <style jsx global>{`
        .toast-container {
          position: fixed; bottom: 24px; right: 24px; z-index: 9999;
          display: flex; flex-direction: column; gap: 10px;
          pointer-events: none;
        }
        .toast {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: 10px;
          font-size: 13px; font-weight: 500; cursor: pointer;
          pointer-events: all; min-width: 220px; max-width: 360px;
          box-shadow: var(--shadow-md);
          animation: toastIn 0.25s ease;
        }
        .toast-success { background: #166534; color: #bbf7d0; }
        .toast-error { background: #7f1d1d; color: #fecaca; }
        .toast-info { background: var(--bg2); color: var(--text); border: 1px solid var(--border); }
        .toast-ico { font-size: 18px; flex-shrink: 0; }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
