"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ListOrdered, Plus } from "lucide-react";
import { AppShell, useSidebarData } from "@/src/components/AppShell";
import {
  AcronymTag,
  ScorePill,
  acronymsOf,
  formatMatchDateTime,
  scoreLine,
} from "@/src/components/matches/MatchesShared";
import {
  ErrorCard,
  LoadingCard,
  StateCard,
  describeLoadError,
  stateButtonClass,
} from "@/src/components/ListStates";
import { NewMatchModal } from "@/src/components/matches/NewMatchModal";
import { FLASH_KEY } from "@/src/services/clubs";
import {
  matchesService,
  type LinhaClassificacao,
  type Partida,
  type PartidaDetalhe,
} from "@/src/services/matches";

const MINUS = "−";

const CRITERIA = [
  "Mais pontos",
  "Maior saldo de gols",
  "Mais gols marcados",
  "Nome do clube, de A a Z",
];

/** Saldo com sinal: +2 / −2 / 0. */
function signed(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${MINUS}${Math.abs(value)}`;
  return "0";
}

export default function ClassificacaoPage() {
  const router = useRouter();
  const sidebar = useSidebarData();
  const reloadSidebar = sidebar.reload;

  const [rows, setRows] = useState<LinhaClassificacao[] | null>(null);
  const [matches, setMatches] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      matchesService.standings(),
      // Sem as últimas partidas a tabela continua útil: o card fica vazio.
      matchesService.list().catch(() => [] as Partida[]),
    ])
      .then(([standings, list]) => {
        if (cancelled) return;
        setRows(standings);
        setMatches(list);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(describeLoadError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function refresh() {
    setLoading(true);
    setReloadToken((value) => value + 1);
    reloadSidebar();
  }

  const acronyms = useMemo(() => acronymsOf(sidebar.clubs), [sidebar.clubs]);
  const last = matches[0];
  const recent = matches.slice(0, 5);

  function handlePlayed(match: PartidaDetalhe) {
    try {
      sessionStorage.setItem(
        FLASH_KEY,
        JSON.stringify({
          title: "Partida jogada",
          description: `${scoreLine(match)}. Placar e duelos devolvidos pela API.`,
        }),
      );
    } catch {
      // Sem sessionStorage o aviso simplesmente não aparece.
    }
    reloadSidebar();
    setModalOpen(false);
    router.push(`/partidas/${match.id}`);
  }

  return (
    <AppShell
      sidebar={sidebar}
      crumbs={[{ label: "Liga" }, { label: "Classificação" }]}
      activeSection="classificacao"
      onRefresh={refresh}
      refreshing={loading}
    >
      <div className="mx-auto max-w-[1180px]">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#155DFC]/40 bg-[#155DFC]/[0.06] text-[#155DFC]">
              <ListOrdered size={18} strokeWidth={1.7} />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold leading-7 tracking-tight">Classificação</h1>
              <p className="text-[13px] text-neutral-500">
                Todos os clubes, com 3 pontos por vitória e 1 por empate.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50"
          >
            <Plus size={15} strokeWidth={2} />
            Nova partida
          </button>
        </div>

        {error && !rows ? (
          <div className="mt-6">
            <ErrorCard
              what="a classificação"
              message={error}
              onRetry={refresh}
              retrying={loading}
            />
          </div>
        ) : !rows ? (
          <div className="mt-6">
            <LoadingCard label="Carregando classificação…" rows={5} />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6">
            <StateCard
              icon={ListOrdered}
              title="Nenhum clube cadastrado"
              description="A classificação mostra todos os clubes, mesmo os que ainda não jogaram."
            >
              <Link href="/clubes?novo=1" className={stateButtonClass}>
                <Plus size={14} strokeWidth={2} />
                Novo clube
              </Link>
            </StateCard>
          </div>
        ) : (
          <>
            <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
              {/* Tabela */}
              <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-[14px]">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-[13px] text-neutral-600">
                        <th className="w-16 px-4 py-3 text-center font-medium">#</th>
                        <th className="px-3 py-3 text-left font-medium">Clube</th>
                        {["J", "V", "E", "D", "GP", "GC", "SG", "Pts"].map((label) => (
                          <th key={label} className="px-3 py-3 text-center font-medium">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.club_id}
                          className={`border-b border-neutral-200 ${loading ? "opacity-60" : ""}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <span
                              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[12px] font-semibold ${
                                row.position === 1
                                  ? "bg-[#155DFC] text-white"
                                  : "bg-neutral-100 text-neutral-800"
                              }`}
                            >
                              {row.position}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2.5">
                              <AcronymTag>{acronyms.get(row.club_id) ?? "—"}</AcronymTag>
                              <Link
                                href={`/clubes/${row.club_id}`}
                                className="font-medium underline underline-offset-2 hover:text-[#155DFC]"
                              >
                                {row.club_name}
                              </Link>
                            </div>
                          </td>
                          <Stat value={row.played} />
                          <Stat value={row.wins} />
                          <Stat value={row.draws} />
                          <Stat value={row.losses} />
                          <Stat value={row.goals_for} />
                          <Stat value={row.goals_against} />
                          <Stat value={row.goal_difference} text={signed(row.goal_difference)} />
                          <Stat value={row.points} bold />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-5 py-3.5 text-[12px] text-neutral-500">
                  J: jogos · V: vitórias · E: empates · D: derrotas · GP: gols marcados · GC: gols
                  sofridos · SG: saldo de gols · Pts: pontos
                </p>
              </section>

              {/* Lateral */}
              <div className="space-y-5">
                <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                  <div className="border-b border-neutral-200 px-5 py-4">
                    <h2 className="text-[16px] font-semibold">Últimas partidas</h2>
                    <p className="mt-0.5 text-[12px] text-neutral-500">
                      Da mais recente para a mais antiga.
                    </p>
                  </div>
                  <div className="px-5 py-4">
                    {recent.length === 0 ? (
                      <p className="text-[13px] text-neutral-500">Nenhuma partida jogada ainda.</p>
                    ) : (
                      <ul className="space-y-4">
                        {recent.map((match) => (
                          <li key={match.id}>
                            <Link href={`/partidas/${match.id}`} className="group block">
                              <p className="text-[12px] tabular-nums text-neutral-500">
                                {formatMatchDateTime(match.played_at)}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] group-hover:text-[#155DFC]">
                                <span
                                  className={match.result === "MANDANTE" ? "font-semibold" : ""}
                                >
                                  {match.home.club_name}
                                </span>
                                <ScorePill home={match.home.goals} away={match.away.goals} />
                                <span
                                  className={match.result === "VISITANTE" ? "font-semibold" : ""}
                                >
                                  {match.away.club_name}
                                </span>
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href="/partidas"
                      className="mt-4 inline-flex items-center gap-2 px-1 text-[14px] font-medium text-[#155DFC] hover:underline"
                    >
                      Ver todas as partidas
                      <ArrowRight size={15} strokeWidth={1.8} />
                    </Link>
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                  <div className="border-b border-neutral-200 px-5 py-4">
                    <h2 className="text-[16px] font-semibold">Ordem da tabela</h2>
                    <p className="mt-0.5 text-[12px] text-neutral-500">
                      Critérios de classificação, nesta ordem.
                    </p>
                  </div>
                  <ol className="space-y-3 px-5 py-4">
                    {CRITERIA.map((criterion, index) => (
                      <li key={criterion} className="flex items-center gap-3 text-[14px]">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-[12px] font-medium">
                          {index + 1}
                        </span>
                        {criterion}
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </div>

            <p className="mt-6 text-[12px] leading-5 text-neutral-500">
              Classificação de 1 a {rows.length}, com os clubes sem partidas zerados. Pontos, saldo
              e posição são calculados a cada consulta, nunca gravados.
            </p>
          </>
        )}
      </div>

      {modalOpen && (
        <NewMatchModal
          clubs={sidebar.clubs}
          defaultHomeId={last?.home.club_id}
          defaultAwayId={last?.away.club_id}
          onClose={() => setModalOpen(false)}
          onPlayed={handlePlayed}
        />
      )}
    </AppShell>
  );
}

/** Célula numérica: zero fica apagado, como no Figma. */
function Stat({ value, text, bold = false }: { value: number; text?: string; bold?: boolean }) {
  return (
    <td
      className={`px-3 py-4 text-center tabular-nums ${bold ? "font-semibold" : ""} ${
        value === 0 && !bold ? "text-neutral-500" : ""
      }`}
    >
      {text ?? value}
    </td>
  );
}
