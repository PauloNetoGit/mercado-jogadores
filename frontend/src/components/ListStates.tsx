"use client";

import type { ReactNode } from "react";
import { Loader2, RefreshCw, ServerOff, type LucideIcon } from "lucide-react";

/** Texto padrão quando o fetch nem chegou à API (rede caída, backend parado). */
export const NETWORK_MESSAGE =
  "Não foi possível carregar os dados. Verifique a conexão e tente de novo.";

/**
 * Mensagem do estado de erro: se a API respondeu, mostra o `message` dela; se a requisição nem
 * chegou (o fetch lança TypeError) ou veio sem mensagem útil, usa o texto padrão de conexão.
 */
export function describeLoadError(err: unknown, fallback = NETWORK_MESSAGE) {
  if (err instanceof TypeError) return NETWORK_MESSAGE;
  if (err instanceof Error && err.message && err.message !== "Erro ao processar requisição") {
    return err.message;
  }
  return fallback;
}

/** Botão branco dos estados: "Tentar de novo", "Limpar filtros", "Novo clube"... */
export const stateButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60";

/** Cartão centralizado: ícone, título, texto e (opcional) uma ação. */
export function StateCard({
  icon: Icon,
  title,
  description,
  role,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  role?: "alert" | "status";
  children?: ReactNode;
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
        <Icon size={22} strokeWidth={1.5} />
      </span>
      <h2 className="mt-5 text-[15px] font-semibold">{title}</h2>
      {description && (
        <p className="mt-2.5 max-w-[440px] text-[13px] leading-5 text-neutral-500">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Erro de carregamento: "Não foi possível carregar {what}" + "Tentar de novo". */
export function ErrorCard({
  what,
  message,
  onRetry,
  retrying = false,
}: {
  /** Com artigo, como aparece no título: "os jogadores", "o histórico", "a classificação". */
  what: string;
  message: string;
  onRetry: () => void;
  /** A nova tentativa está em andamento: desabilita o botão e mostra o spinner. */
  retrying?: boolean;
}) {
  return (
    <StateCard
      icon={ServerOff}
      role="alert"
      title={`Não foi possível carregar ${what}`}
      description={message}
    >
      <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying} className={stateButtonClass}>
        {retrying ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RefreshCw size={14} strokeWidth={1.8} />
        )}
        Tentar de novo
      </button>
    </StateCard>
  );
}

/** "◌ Carregando jogadores…" */
export function LoadingLabel({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-2.5 text-[13px] text-neutral-600">
      <Loader2 size={15} strokeWidth={1.8} className="animate-spin text-neutral-500" />
      {label}
    </span>
  );
}

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-neutral-100 ${className}`} />;
}

/** Carregando genérico: cabeçalho com spinner e barras cinzas. */
export function LoadingCard({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3.5">
        <LoadingLabel label={label} />
        <SkeletonBar className="h-9 w-[190px] rounded-lg" />
      </div>
      <div className="space-y-5 px-4 py-5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <SkeletonBar className="h-8 w-8 shrink-0 rounded-full" />
            <SkeletonBar className="h-3.5 w-full max-w-[420px]" />
            <SkeletonBar className="ml-auto hidden h-3.5 w-24 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
