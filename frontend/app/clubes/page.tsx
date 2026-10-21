"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Shield,
} from "lucide-react";
import { AppShell, useSidebarData } from "@/src/components/AppShell";
import {
  ErrorCard,
  LoadingLabel,
  StateCard,
  describeLoadError,
  stateButtonClass,
} from "@/src/components/ListStates";
import { NewClubModal } from "@/src/components/clubs/NewClubModal";
import {
  CAIXA_INICIAL,
  FLASH_KEY,
  MAX_CLUBES,
  clubsService,
  type OrdenacaoClubes,
} from "@/src/services/clubs";
import type { Clube } from "@/src/types";
import { formatMoney } from "@/src/utils/format";

const SORT_OPTIONS: { value: OrdenacaoClubes; label: string; short: string }[] =
  [
    { value: "name", label: "Nome", short: "nome" },
    {
      value: "net_worth_desc",
      label: "Patrimônio (maior para o menor)",
      short: "patrimônio (maior para o menor)",
    },
    {
      value: "net_worth_asc",
      label: "Patrimônio (menor para o maior)",
      short: "patrimônio (menor para o maior)",
    },
  ];

export default function ClubesPage() {
  const router = useRouter();
  const sidebar = useSidebarData();
  const reloadSidebar = sidebar.reload;

  const [clubs, setClubs] = useState<Clube[]>([]);
  const [sort, setSort] = useState<OrdenacaoClubes>("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [sortOpen, setSortOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [queryDismissed, setQueryDismissed] = useState(false);

  // O "+" da barra lateral em outras telas chega aqui com ?novo=1.
  // useSyncExternalStore evita divergência entre servidor e cliente na hidratação.
  const urlSearch = useSyncExternalStore(
    subscribeNoop,
    () => window.location.search,
    () => "",
  );
  const modalOpen =
    manualOpen ||
    (!queryDismissed && new URLSearchParams(urlSearch).get("novo") === "1");

  const sortRef = useRef<HTMLDivElement>(null);

  const atLimit = clubs.length >= MAX_CLUBES;

  useEffect(() => {
    let cancelled = false;

    clubsService
      .list(sort)
      .then((data) => {
        if (cancelled) return;
        setClubs(data);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(describeLoadError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Ignora respostas antigas se a ordenação mudar no meio do caminho.
    return () => {
      cancelled = true;
    };
  }, [sort, reloadToken]);

  // Fecha o menu de ordenação ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!sortOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!sortRef.current?.contains(event.target as Node)) setSortOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSortOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sortOpen]);

  const openModal = useCallback(() => setManualOpen(true), []);
  const closeModal = useCallback(() => {
    setManualOpen(false);
    setQueryDismissed(true);
    if (window.location.search)
      window.history.replaceState(null, "", "/clubes");
  }, []);

  function handleCreated(club: Clube) {
    // O aviso é exibido na tela do clube recém-criado.
    try {
      sessionStorage.setItem(
        FLASH_KEY,
        JSON.stringify({
          title: "Clube criado",
          description: `${club.name} (${club.acronym}) começa com ${formatMoney(CAIXA_INICIAL)} em caixa.`,
        }),
      );
    } catch {
      // Sem sessionStorage o aviso simplesmente não aparece.
    }
    closeModal();
    router.push(`/clubes/${club.id}`);
  }

  function refresh() {
    setLoading(true);
    setReloadToken((value) => value + 1);
    reloadSidebar();
  }

  function changeSort(next: OrdenacaoClubes) {
    if (next !== sort) setLoading(true);
    setSort(next);
    setSortOpen(false);
  }

  const selected =
    SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  return (
    <AppShell
      sidebar={sidebar}
      crumbs={[{ label: "Mercado" }, { label: "Clubes" }]}
      activeSection="clubes"
      onNewClub={openModal}
      onRefresh={refresh}
      refreshing={loading}
    >
      <div className="mx-auto max-w-[1180px]">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#155DFC]/40 bg-[#155DFC]/[0.06] text-[#155DFC]">
              <Shield size={18} strokeWidth={1.7} />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold leading-7 tracking-tight">
                Clubes
              </h1>
              <p className="text-[13px] text-neutral-500">
                Cada clube começa com {formatMoney(CAIXA_INICIAL)} em caixa e
                sem jogadores. A liga aceita no máximo {MAX_CLUBES} clubes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openModal}
            disabled={atLimit}
            title={
              atLimit
                ? `A liga já possui o limite de ${MAX_CLUBES} clubes.`
                : undefined
            }
            className="flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} strokeWidth={2} />
            Novo clube
          </button>
        </div>

        {/* Tabela */}
        <section className="mt-5 rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[13px] font-semibold">
                {clubs.length} {clubs.length === 1 ? "clube" : "clubes"}
              </span>
              <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                {clubs.length} de {MAX_CLUBES}
              </span>
            </div>

            <div ref={sortRef} className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={sortOpen}
                className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-[13px] shadow-sm transition hover:bg-neutral-50"
              >
                <ArrowUpDown
                  size={13}
                  strokeWidth={1.7}
                  className="text-neutral-600"
                />
                Ordenar: {selected.short}
                <ChevronDown
                  size={13}
                  strokeWidth={1.7}
                  className="text-neutral-600"
                />
              </button>

              {sortOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+4px)] z-20 w-[250px] rounded-xl border border-neutral-200 bg-white p-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
                >
                  <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-neutral-500">
                    Ordenar por
                  </p>
                  {SORT_OPTIONS.map((option) => {
                    const isSelected = option.value === sort;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isSelected}
                        onClick={() => changeSort(option.value)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition hover:bg-neutral-100 ${
                          isSelected ? "bg-neutral-100" : ""
                        }`}
                      >
                        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                          {isSelected && <Check size={13} strokeWidth={2} />}
                        </span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {error && clubs.length === 0 && !loading && (
            <div className="border-t border-neutral-200 p-4">
              <ErrorCard
                what="os clubes"
                message={error}
                onRetry={refresh}
                retrying={loading}
              />
            </div>
          )}

          {!error && !loading && clubs.length === 0 && (
            <div className="border-t border-neutral-200 p-4">
              <StateCard
                icon={Shield}
                title="Nenhum clube cadastrado"
                description="Crie o primeiro clube para começar."
              >
                <button
                  type="button"
                  onClick={openModal}
                  className={stateButtonClass}
                >
                  <Plus size={14} strokeWidth={1.8} />
                  Novo clube
                </button>
              </StateCard>
            </div>
          )}

          <div
            className={`overflow-x-auto border-t border-neutral-200 ${
              clubs.length === 0 && !loading ? "hidden" : ""
            }`}
          >
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-neutral-50 text-[12px] text-neutral-500">
                  <th scope="col" className="px-4 py-2.5 text-left font-normal">
                    Clube
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-normal">
                    Sigla
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-normal"
                  >
                    Caixa
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-normal"
                  >
                    Valor do elenco
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-normal"
                  >
                    Patrimônio
                  </th>
                  <th scope="col" className="w-[120px] px-4 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && clubs.length === 0 && <SkeletonRows />}

                {clubs.map((club) => (
                  <tr
                    key={club.id}
                    className={`border-t border-neutral-200 transition hover:bg-neutral-50/70 ${
                      loading ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[10px] font-semibold text-neutral-700">
                          {club.acronym}
                        </span>
                        <span className="font-medium">{club.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium shadow-sm">
                        {club.acronym}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatMoney(club.cash)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatMoney(club.squad_value)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatMoney(club.net_worth)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/clubes/${club.id}`}
                        aria-label={`Ver clube ${club.name}`}
                        className="flex items-center justify-end gap-1 font-medium transition hover:text-[#155DFC]"
                      >
                        Ver clube
                        <ChevronRight size={14} strokeWidth={1.8} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-3 text-[11px] text-neutral-500">
          Clubes pelo nome por padrão ou pelo patrimônio, do maior para o menor,
          com empate desfeito pelo nome.
        </p>
      </div>

      {modalOpen && (
        <NewClubModal
          clubs={clubs}
          onClose={closeModal}
          onCreated={handleCreated}
        />
      )}
    </AppShell>
  );
}

function subscribeNoop() {
  return () => {};
}

function SkeletonRows() {
  return (
    <>
      <tr>
        <td colSpan={6} className="px-4 py-3">
          <LoadingLabel label="Carregando clubes…" />
        </td>
      </tr>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="border-t border-neutral-200">
          <td className="px-4 py-3.5" colSpan={6}>
            <div className="h-4 w-full max-w-[640px] animate-pulse rounded bg-neutral-100" />
          </td>
        </tr>
      ))}
    </>
  );
}