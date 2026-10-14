"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; text: string; tone: "success" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Toasts unten mittig (über der Suchleiste); Dauer abhängig von der Textlänge. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    const duration = Math.min(9000, 2500 + text.length * 45);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--searchbar-h)+12px)] z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex max-w-md animate-fade-up items-start gap-2.5 rounded-xl border bg-surface-2 px-4 py-3 text-sm text-text shadow-2xl",
              t.tone === "error" ? "border-danger/50" : "border-border",
            )}
          >
            {t.tone === "error" ? (
              <AlertCircle size={17} className="mt-px shrink-0 text-danger" />
            ) : (
              <CheckCircle2 size={17} className="mt-px shrink-0 text-success" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
