"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  /** Impede fechar (Esc, X, fundo) durante o envio. */
  busy?: boolean;
  width?: number;
  children: ReactNode;
}

export function Modal({
  title,
  description,
  onClose,
  busy = false,
  width = 440,
  children,
}: ModalProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
        className="my-auto w-full rounded-xl border border-neutral-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-[12px] leading-5 text-neutral-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function ModalActions({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}

export const btnSecondary =
  "h-9 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium transition hover:bg-neutral-50 disabled:opacity-60";
export const btnPrimary =
  "flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95 disabled:opacity-60";
export const inputClass =
  "h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] outline-none transition focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/15 disabled:bg-neutral-50 disabled:text-neutral-500";
