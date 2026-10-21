"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CircleAlert, RefreshCw } from "lucide-react";
import { AppShell, useSidebarData } from "@/src/components/AppShell";
import { DuelsTable } from "@/src/components/matches/DuelsTable";
import { FieldLegend, MatchField } from "@/src/components/matches/MatchField";
import { MatchHero, acronymsOf, scoreLine } from "@/src/components/matches/MatchesShared";
import { Toast, type ToastData } from "@/src/components/Toast";
import { FLASH_KEY } from "@/src/services/clubs";
import { matchesService, type PartidaDetalhe } from "@/src/services/matches";

export default function PartidaPage() {
  // useParams precisa de Suspense com cacheComponents ativo.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafafa]" />}>
      <PartidaRoute />
    </Suspense>
  );
}

function PartidaRoute() {
  const params = useParams<{ id: string }>();
  // key: ao trocar de partida, o estado da tela é reiniciado.
  return <PartidaDetalheView key={params.id} id={Number(params.id)} />;
}

function PartidaDetalheView({ id }: { id: number }) {
  const validId = Number.isInteger(id) && id > 0;

  const sidebar = useSidebarData();
  const reloadSidebar = sidebar.reload;

  const [match, setMatch] = useState<PartidaDetalhe | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState(validId ? "" : "Partida não encontrada.");
  const [reloadToken, setReloadToken] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    matchesService
      .get(id)
      .then((data) => {
        if (cancelled) return;
        setMatch(data);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMatch(null);
        setError(err instanceof Error ? err.message : "Não foi possível carregar a partida.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, validId, reloadToken]);

  // Aviso deixado pela tela de partidas ("Partida jogada"). Lê o sessionStorage e consome na hora.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY);
      if (!raw) return;
      sessionStorage.removeItem(FLASH_KEY);
      const flash = JSON.parse(raw) as { title: string; description?: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com sessionStorage (sistema externo)
      setToast({ id: Date.now(), variant: "success", ...flash });
    } catch {
      // Aviso opcional: ignora falhas de leitura.
    }
  }, []);

  const closeToast = useCallback(() => setToast(null), []);
  const acronyms = useMemo(() => acronymsOf(sidebar.clubs), [sidebar.clubs]);

  function refresh() {
    setLoading(true);
    setReloadToken((value) => value + 1);
    reloadSidebar();
  }

  return (
    <AppShell
      sidebar={sidebar}
      crumbs={[
        { label: "Liga" },
        { label: "Partidas", href: "/partidas" },
        { label: match ? scoreLine(match) : "Partida" },
      ]}
      activeSection="partidas"
      onRefresh={refresh}
      refreshing={loading}
    >
      <div className="mx-auto max-w-[1180px]">
        <Link
          href="/partidas"
          className="inline-flex items-center gap-2 px-1 py-1 text-[14px] font-medium transition hover:text-[#155DFC]"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          Voltar para partidas
        </Link>

        {error ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          >
            <CircleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-[13px] leading-5">
              <p className="font-medium text-red-800">Não foi possível abrir a partida</p>
              <p>{error}</p>
            </div>
            {validId && (
              <button
                type="button"
                onClick={refresh}
                className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-red-800 hover:underline"
              >
                <RefreshCw size={13} strokeWidth={1.8} />
                Tentar de novo
              </button>
            )}
          </div>
        ) : !match ? (
          <div aria-hidden className="mt-5 animate-pulse space-y-5">
            <div className="h-[158px] rounded-xl bg-neutral-100" />
            <div className="h-[460px] rounded-xl bg-neutral-100" />
            <div className="h-[420px] rounded-xl bg-neutral-100" />
          </div>
        ) : (
          <div className={`mt-5 space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <MatchHero match={match} acronyms={acronyms} showFormations />

            <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <h2 className="text-[16px] font-semibold">Em campo</h2>
                  <p className="mt-0.5 text-[12px] text-neutral-500">
                    Titulares de cada clube na formação da partida e os valores usados nos duelos, já com o efeito
                    da condição.
                  </p>
                </div>
                <FieldLegend />
              </div>
              <MatchField match={match} />
            </section>

            <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="px-5 pb-4 pt-4">
                <h2 className="text-[16px] font-semibold">Duelos</h2>
                <p className="mt-0.5 text-[12px] leading-5 text-neutral-500">
                  Os 3 ataques do mandante e depois os 3 do visitante. Os jogadores de linha vão do 1º (o mais
                  recuado) ao 4º (o mais avançado), pela ordem do elenco: o 4º ataca o goleiro, o 3º ataca o 1º e o
                  2º ataca o 2º.
                </p>
              </div>
              <DuelsTable match={match} acronyms={acronyms} />
            </section>

            <p className="text-[12px] leading-5 text-neutral-500">
              Mesma tela logo depois de jogar e ao abrir uma partida do histórico, com as formações dos dois clubes
              e os 6 duelos. Os valores e a condição de cada titular vêm gravados nos duelos devolvidos pela API: mal
              condicionado joga com 15% a menos.
            </p>
          </div>
        )}
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </AppShell>
  );
}