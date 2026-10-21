"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Shield, Swords } from "lucide-react";
import { AppShell, useSidebarData } from "@/src/components/AppShell";
import {
  AcronymTag,
  MatchHero,
  ResultBadge,
  ScorePill,
  acronymsOf,
  formatMatchDate,
  formatMatchTime,
  scoreLine,
} from "@/src/components/matches/MatchesShared";
import { ErrorCard, LoadingCard, StateCard, describeLoadError } from "@/src/components/ListStates";
import { NewMatchModal } from "@/src/components/matches/NewMatchModal";
import { FLASH_KEY } from "@/src/services/clubs";
import { matchesService, type Partida, type PartidaDetalhe } from "@/src/services/matches";

export default function PartidasPage() {
  const router = useRouter();
  const sidebar = useSidebarData();
  const reloadSidebar = sidebar.reload;

  const [matches, setMatches] = useState<Partida[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [clubFilter, setClubFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    matchesService
      .list()
      .then((data) => {
        if (cancelled) return;
        setMatches(data);
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
  const last = matches?.[0];
  const selectedClub = sidebar.clubs.find((club) => String(club.id) === clubFilter);
  const visible = useMemo(() => {
    if (!matches) return [];
    if (!clubFilter) return matches;
    const id = Number(clubFilter);
    return matches.filter((match) => match.home.club_id === id || match.away.club_id === id);
  }, [matches, clubFilter]);

  function handlePlayed(match: PartidaDetalhe) {
    // O aviso aparece na tela da partida recém-jogada.
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
      crumbs={[{ label: "Liga" }, { label: "Partidas" }]}
      activeSection="partidas"
      onRefresh={refresh}
      refreshing={loading}
    >
      <div className="mx-auto max-w-[1180px]">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#155DFC]/40 bg-[#155DFC]/[0.06] text-[#155DFC]">
              <Swords size={18} strokeWidth={1.7} />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold leading-7 tracking-tight">Partidas</h1>
              <p className="text-[13px] text-neutral-500">
                Jogue partidas entre clubes com os 5 titulares escalados e acompanhe o histórico.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95"
          >
            <Plus size={15} strokeWidth={2} />
            Nova partida
          </button>
        </div>

        {error && !matches ? (
          <div className="mt-6">
            <ErrorCard what="as partidas" message={error} onRetry={refresh} retrying={loading} />
          </div>
        ) : loading && !matches ? (
          <div className="mt-6">
            <LoadingCard label="Carregando partidas…" rows={3} />
          </div>
        ) : matches && matches.length === 0 ? (
          <div className="mt-6">
            <StateCard
              icon={Swords}
              title="Nenhuma partida jogada"
              description="Escale os 5 titulares de dois clubes e jogue a primeira partida. O resultado aparece aqui e na classificação."
            >
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95"
              >
                <Plus size={15} strokeWidth={2} />
                Nova partida
              </button>
            </StateCard>
            <p className="mt-5 text-[12px] leading-5 text-neutral-500">
              Nenhuma partida jogada ainda. A classificação continua com todos os clubes, zerados.
            </p>
          </div>
        ) : (
          <>
            {/* Última partida */}
            <p className="mt-6 text-[13px] text-neutral-500">Última partida</p>
            <div className="mt-2">
              {last && (
                <MatchHero
                  match={last}
                  acronyms={acronyms}
                  action={
                    <Link
                      href={`/partidas/${last.id}`}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50"
                    >
                      Ver duelos
                      <ChevronRight size={14} strokeWidth={1.8} />
                    </Link>
                  }
                />
              )}
            </div>

            {/* Histórico */}
            <section className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold">Histórico de partidas</h2>
                  <p className="mt-0.5 text-[12px] text-neutral-500">Da mais recente para a mais antiga.</p>
                </div>

                <div className="relative inline-flex h-9 min-w-[200px] items-center gap-2 rounded-lg border border-neutral-300 bg-white pl-3 pr-2.5 text-[13px] shadow-sm focus-within:ring-2 focus-within:ring-[#155DFC]/25">
                  <Shield size={14} strokeWidth={1.7} className="text-neutral-600" />
                  <span className="flex-1 truncate text-neutral-700">
                    Clube: {selectedClub ? selectedClub.name : "todos"}
                  </span>
                  <ChevronDown size={14} className="text-neutral-500" />
                  <select
                    value={clubFilter}
                    onChange={(event) => setClubFilter(event.target.value)}
                    aria-label="Filtrar por clube"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  >
                    <option value="">Todos os clubes</option>
                    {sidebar.clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-[13px]">
                  <thead>
                    <tr className="border-y border-neutral-200 bg-neutral-50 text-left text-[12px] text-neutral-500">
                      <th className="px-5 py-2.5 font-medium">Data e hora</th>
                      <th className="px-3 py-2.5 text-right font-medium">Mandante</th>
                      <th className="px-3 py-2.5 text-center font-medium">Placar</th>
                      <th className="px-3 py-2.5 font-medium">Visitante</th>
                      <th className="px-3 py-2.5 font-medium">Resultado</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-neutral-500">
                          Este clube ainda não jogou nenhuma partida.
                        </td>
                      </tr>
                    ) : (
                      visible.map((match) => (
                        <tr key={match.id} className="border-b border-neutral-200">
                          <td className="whitespace-nowrap px-5 py-3.5 tabular-nums">
                            {formatMatchDate(match.played_at)}{" "}
                            <span className="ml-1 text-neutral-500">{formatMatchTime(match.played_at)}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <span className={match.result === "MANDANTE" ? "font-semibold" : ""}>
                                {match.home.club_name}
                              </span>
                              <AcronymTag>{acronyms.get(match.home.club_id) ?? "—"}</AcronymTag>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <ScorePill home={match.home.goals} away={match.away.goals} />
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2">
                              <AcronymTag>{acronyms.get(match.away.club_id) ?? "—"}</AcronymTag>
                              <span className={match.result === "VISITANTE" ? "font-semibold" : ""}>
                                {match.away.club_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <ResultBadge result={match.result} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/partidas/${match.id}`}
                              className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
                            >
                              Ver duelos
                              <ChevronRight size={14} strokeWidth={1.8} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="px-5 py-3.5 text-[13px] text-neutral-500">
                {visible.length} {visible.length === 1 ? "partida" : "partidas"}
              </p>
            </section>

            <p className="mt-5 text-[12px] leading-5 text-neutral-500">
              Partidas da mais recente para a mais antiga, com filtro por clube. “Ver duelos” abre a partida.
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