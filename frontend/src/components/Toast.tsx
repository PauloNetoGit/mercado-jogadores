"use client";

import { useEffect } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

export interface ToastData {
  id: number;
  title: string;
  description?: string;
  variant?: "success" | "error";
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
  durationMs?: number;
}

/** Aviso temporário no canto inferior direito, como no protótipo. */
export function Toast({ toast, onClose, durationMs = 6000 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, onClose, durationMs]);

  if (!toast) return null;

  const isError = toast.variant === "error";
  const Icon = isError ? CircleAlert : CheckCircle2;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[70] w-[calc(100vw-2.5rem)] max-w-[330px] rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-start gap-2.5">
        <Icon
          size={16}
          strokeWidth={1.9}
          className={`mt-0.5 shrink-0 ${isError ? "text-red-600" : "text-green-700"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-5 text-neutral-950">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-0.5 text-[12px] leading-[18px] text-neutral-500">
              {toast.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          className="shrink-0 rounded-md p-0.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
