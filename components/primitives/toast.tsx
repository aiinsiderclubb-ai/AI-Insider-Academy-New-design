"use client";

import * as React from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Tone };

const ToastContext = React.createContext<{
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const tones: Record<Tone, { icon: React.ElementType; className: string }> = {
  neutral: { icon: Info, className: "text-ink-3" },
  success: { icon: Check, className: "text-success" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  danger: { icon: AlertTriangle, className: "text-danger" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, tone: "neutral", ...input }]);
      window.setTimeout(() => dismiss(id), input.action ? 8000 : 5000);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Уведомления"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = tones[toast.tone];
          return (
            <output
              key={toast.id}
              className="animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-pop"
            >
              <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", className)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ink">{toast.title}</p>
                {toast.body && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{toast.body}</p>}
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                    className="mt-2 text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Закрыть уведомление"
                className="-m-1 rounded-md p-1 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </output>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
