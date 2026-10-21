"use client";

import type { ReactNode } from "react";
import type { Clube } from "@/src/types";
import type { Partida, ResultadoPartida } from "@/src/services/matches";

const TZ = "America/Sao_Paulo";

export function formatMatchDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ }).format(new Date(iso));
}

export function formatMatchTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "11/11/2026, 20:00" */
export function formatMatchDateTime(iso: string) {
  return `${formatMatchDate(iso)}, ${formatMatchTime(iso)}`;
}

export const RESULT_LABEL: Record<ResultadoPartida, string> = {
  MANDANTE: "Vitória do mandante",
  VISITANTE: "Vitória do visitante",
  EMPATE: "Empate",
};

/** Sigla de cada clube pelo id (a API de partidas e de classificação só devolve o nome). */
export function acronymsOf(clubs: Clube[]) {
  return new Map(clubs.map((club) => [club.id, club.acronym]));
}

/** "Delta FC 2 × 1 Águias FC" */
export function scoreLine(match: Pick<Partida, "home" | "away">) {
  return `${match.home.club_name} ${match.home.goals} × ${match.away.goals} ${match.away.club_name}`;
}

export function ResultBadge({ result }: { result: ResultadoPartida }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-800">
      {RESULT_LABEL[result]}
    </span>
  );
}

/** Placar em caixa cinza: "2 × 1". */
export function ScorePill({
  home,
  away,
  size = "sm",
}: {
  home: number;
  away: number;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-neutral-100 font-semibold tabular-nums ${
        size === "lg" ? "px-5 py-1.5 text-[28px] leading-9" : "px-2.5 py-1 text-[13px]"
      }`}
    >
      {home} × {away}
    </span>
  );
}

/** Sigla pequena ao lado do nome do clube (DEL, AGU...). */
export function AcronymTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
      {children}
    </span>
  );
}

/** Sigla grande no cartão do confronto. */
function AcronymBox({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[13px] font-semibold">
      {children}
    </span>
  );
}

/**
 * Confronto em destaque: mandante · placar · visitante.
 * `formations` troca "Mandante" por "Mandante · 2-1-1" (tela da partida).
 */
export function MatchHero({
  match,
  acronyms,
  showFormations = false,
  action,
}: {
  match: Partida;
  acronyms: Map<number, string>;
  showFormations?: boolean;
  action?: ReactNode;
}) {
  const acronym = (id: number, name: string) =>
    acronyms.get(id) ?? name.slice(0, 3).toUpperCase();

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-x-5 gap-y-4 rounded-xl border border-neutral-200 bg-white px-6 py-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[16px] font-semibold">{match.home.club_name}</p>
          <p className="text-[12px] text-neutral-500">
            Mandante{showFormations ? ` · ${match.home.formation}` : ""}
          </p>
        </div>
        <AcronymBox>{acronym(match.home.club_id, match.home.club_name)}</AcronymBox>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <ScorePill home={match.home.goals} away={match.away.goals} size="lg" />
        <p className="text-[12px] tabular-nums text-neutral-500">
          {formatMatchDateTime(match.played_at)}
        </p>
        <ResultBadge result={match.result} />
      </div>

      <div className="flex items-center gap-3">
        <AcronymBox>{acronym(match.away.club_id, match.away.club_name)}</AcronymBox>
        <div>
          <p className="text-[16px] font-semibold">{match.away.club_name}</p>
          <p className="text-[12px] text-neutral-500">
            Visitante{showFormations ? ` · ${match.away.formation}` : ""}
          </p>
        </div>
      </div>

      {action && <div className="lg:absolute lg:right-6 lg:top-1/2 lg:-translate-y-1/2">{action}</div>}
    </div>
  );
}
