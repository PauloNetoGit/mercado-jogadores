"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Eye,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SearchX,
  Shield,
  Shirt,
  ShoppingCart,
  Trash2,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppShell, useSidebarData } from "@/src/components/AppShell";
import { Toast, type ToastData } from "@/src/components/Toast";
import {
  ErrorCard,
  LoadingLabel,
  SkeletonBar,
  StateCard,
  describeLoadError,
  stateButtonClass,
} from "@/src/components/ListStates";
import { BuyModal } from "@/src/components/players/BuyModal";
import { ConditionModal } from "@/src/components/players/ConditionModal";
import { DeletePlayerModal } from "@/src/components/players/DeletePlayerModal";
import { PlayerFormModal } from "@/src/components/players/PlayerFormModal";
import { PlayerCreatedModal } from "@/src/components/players/PlayerCreatedModal";
import {
  PurchaseDoneModal,
  type PurchaseDoneData,
} from "@/src/components/players/PurchaseDoneModal";
import { Avatar } from "@/src/components/players/Avatar";
import { PlayerDrawer } from "@/src/components/players/PlayerDrawer";
import { btnPrimary, btnSecondary, inputClass } from "@/src/components/Modal";
import {
  CONDICOES,
  POSICOES,
  playersService,
  type FiltrosJogadores,
} from "@/src/services/players";
import type { Jogador } from "@/src/types";
import { formatMoney } from "@/src/utils/format";

const PAGE_SIZE = 10;

type Tab = "all" | "free" | "clubs";

const SORTS = {
  "name:asc": { label: "nome", sort: "name" },
  "market_value:desc": { label: "maior valor de mercado", sort: "value_desc" },
  "market_value:asc": { label: "menor valor de mercado", sort: "value_asc" },
  "age:desc": { label: "maior idade", sort: "age_desc" },
  "age:asc": { label: "menor idade", sort: "age_asc" },
  "position:asc": { label: "posição (GOL a ATA)", sort: "position" },
} as const;
type SortKey = keyof typeof SORTS;

interface Filters {
  search: string;
  position: string;
  condition: string;
  club: string; // "" | "free" | id
  ageMin?: number;
  ageMax?: number;
  valueMin?: number;
  valueMax?: number;
  tab: Tab;
  sort: SortKey;
  page: number;
}

const INITIAL_FILTERS: Filters = {
  search: "",
  position: "",
  condition: "",
  club: "",
  tab: "all",
  sort: "name:asc",
  page: 1,
};

interface Loaded {
  request: object;
  players: Jogador[];
  total: number;
  totalPages: number;
  counts: { all: number; free: number; clubs: number };
  notice?: string;
  error?: string;
}

type Result = Omit<Loaded, "request">;

const EMPTY_RESULT: Result = {
  players: [],
  total: 0,
  totalPages: 1,
  counts: { all: 0, free: 0, clubs: 0 },
};

/** Busca a lista respeitando os filtros; a API filtra, ordena e pagina. */
async function loadList(f: Filters): Promise<Result> {
  const base = {
    search: f.search || undefined,
    position: f.position || undefined,
    condition: f.condition || undefined,
    min_age: f.ageMin,
    max_age: f.ageMax,
    min_value: f.valueMin,
    max_value: f.valueMax,
    sort: SORTS[f.sort].sort,
  } satisfies Partial<FiltrosJogadores>;

  const specificClub = f.club !== "" && f.club !== "free";
  const clubParams: Partial<FiltrosJogadores> =
    f.club === "free"
      ? { free: "true" }
      : specificClub
        ? { club_id: Number(f.club) }
        : {};

  if (f.tab === "free" && specificClub)
    return {
      ...EMPTY_RESULT,
      notice: "“Livres” não combina com o filtro por clube.",
    };
  if (f.tab === "clubs" && f.club === "free")
    return {
      ...EMPTY_RESULT,
      notice: "“Em clubes” não combina com o filtro “Livre”.",
    };

  const query = (
    extra: Partial<FiltrosJogadores>,
    page: number,
    limit: number,
  ) => playersService.list({ ...base, ...clubParams, ...extra, page, limit });

  const tabParam: Partial<FiltrosJogadores> =
    f.club === "free" || specificClub
      ? {}
      : f.tab === "free"
        ? { free: "true" }
        : f.tab === "clubs"
          ? { free: "false" }
          : {};

  const [list, all, free, clubs] = await Promise.all([
    query(tabParam, f.page, PAGE_SIZE),
    query({}, 1, 1),
    specificClub ? Promise.resolve(null) : query({ free: "true" }, 1, 1),
    specificClub || f.club === "free"
      ? Promise.resolve(null)
      : query({ free: "false" }, 1, 1),
  ]);

  return {
    players: list.data,
    total: list.meta.total_items,
    totalPages: Math.max(1, list.meta.total_pages),
    counts: {
      all: all.meta.total_items,
      free: specificClub ? 0 : (free?.meta.total_items ?? all.meta.total_items),
      clubs:
        f.club === "free"
          ? 0
          : specificClub
            ? all.meta.total_items
            : (clubs?.meta.total_items ?? 0),
    },
  };
}

/* -------------------------------------------------------------------------- */

type Dialog =
  | { kind: "create" }
  | { kind: "created"; player: Jogador }
  | { kind: "edit"; player: Jogador }
  | { kind: "condition"; player: Jogador }
  | { kind: "delete"; player: Jogador }
  | { kind: "buy"; player: Jogador }
  | { kind: "bought"; data: PurchaseDoneData };

export default function JogadoresPage() {
  const sidebar = useSidebarData();
  const reloadSidebar = sidebar.reload;

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [token, setToken] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [menu, setMenu] = useState<{
    player: Jogador;
    right: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const [drawer, setDrawer] = useState<Jogador | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const slowReload = useRef(false);

  const request = useMemo(() => ({ filters, token }), [filters, token]);
  const loading = loaded?.request !== request;

  // Busca por nome com atraso, para não chamar a API a cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();
      setFilters((current) =>
        current.search === value
          ? current
          : { ...current, search: value, page: 1 },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
        let cancelled = false;
    const minimum = slowReload.current
      ? new Promise<void>((resolve) => setTimeout(resolve, 1000))
      : Promise.resolve();
    slowReload.current = false;
    Promise.all([loadList(request.filters), minimum])
      .then(([result]) => !cancelled && setLoaded({ request, ...result }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setLoaded({
            request,
            ...EMPTY_RESULT,
            error: describeLoadError(err),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [request]);

  // Fecha menus ao clicar fora.
  useEffect(() => {
    if (!sortOpen && menu === null) return;
    function close() {
      setSortOpen(false);
      setMenu(null);
    }
    document.addEventListener("click", close);
    // O menu é fixo na tela, então fecha ao rolar ou redimensionar.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [sortOpen, menu]);

  const closeToast = useCallback(() => setToast(null), []);

  function patch(next: Partial<Filters>) {
    setFilters((current) => ({ ...current, page: 1, ...next }));
  }

  function clearFilters() {
    setSearchInput("");
    setFilters({ ...INITIAL_FILTERS, sort: filters.sort });
  }

    function manualRefresh() {
    slowReload.current = true;
    setLoaded(null);
    refresh();
  }

  function refresh() {
    setToken((value) => value + 1);
    reloadSidebar();
  }

  function notify(
    title: string,
    description?: string,
    variant: "success" | "error" = "success",
  ) {
    setToast({ id: Date.now(), title, description, variant });
  }

  function done(title: string, description?: string) {
    setDialog(null);
    notify(title, description);
    refresh();
  }

  /** Destaca por alguns segundos a linha que acabou de mudar. */
  function flash(id: number) {
    setHighlightId(id);
    window.setTimeout(
      () => setHighlightId((current) => (current === id ? null : current)),
      4000,
    );
  }

  function openMenu(player: Jogador, button: HTMLElement) {
    setSortOpen(false);
    if (menu?.player.id === player.id) return setMenu(null);
    const rect = button.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    // Abre para cima quando não há espaço embaixo.
    setMenu(
      window.innerHeight - rect.bottom < 280
        ? { player, right, bottom: window.innerHeight - rect.top + 4 }
        : { player, right, top: rect.bottom + 4 },
    );
  }

  const clubsById = useMemo(
    () => new Map(sidebar.clubs.map((club) => [club.id, club])),
    [sidebar.clubs],
  );

  const players = loaded?.players ?? [];
  const counts = loaded?.counts ?? EMPTY_RESULT.counts;
  const total = loaded?.total ?? 0;
  const totalPages = loaded?.totalPages ?? 1;

  const chips: { label: string; clear: Partial<Filters> }[] = [];
  if (filters.search)
    chips.push({ label: `Busca: ${filters.search}`, clear: { search: "" } });
  if (filters.position)
    chips.push({
      label: `Posição: ${POSICOES[filters.position as keyof typeof POSICOES] ?? filters.position}`,
      clear: { position: "" },
    });
  if (filters.condition)
    chips.push({
      label: `Condição: ${CONDICOES[filters.condition as keyof typeof CONDICOES]?.label}`,
      clear: { condition: "" },
    });
  if (filters.club)
    chips.push({
      label: `Clube: ${filters.club === "free" ? "Livre" : (clubsById.get(Number(filters.club))?.name ?? `#${filters.club}`)}`,
      clear: { club: "" },
    });
  if (filters.ageMin !== undefined || filters.ageMax !== undefined)
    chips.push({
      label: `Idade: ${rangeText(filters.ageMin, filters.ageMax, String)}`,
      clear: { ageMin: undefined, ageMax: undefined },
    });
  if (filters.valueMin !== undefined || filters.valueMax !== undefined)
    chips.push({
      label: `Valor de mercado: ${rangeText(filters.valueMin, filters.valueMax, formatMoney)}`,
      clear: { valueMin: undefined, valueMax: undefined },
    });

  const from = players.length ? (filters.page - 1) * PAGE_SIZE + 1 : 0;
  const to = (filters.page - 1) * PAGE_SIZE + players.length;

  // Lista vazia: com filtro ("zzz" sem resultado) ou banco recém-criado (nenhum jogador cadastrado).
  const filtered = chips.length > 0 || filters.tab !== "all";
  const emptyTitle = loaded?.notice
    ? "Nenhum jogador encontrado"
    : filters.search
      ? `Nenhum jogador encontrado para “${filters.search}”`
      : filtered
        ? "Nenhum jogador encontrado com esses filtros"
        : "Nenhum jogador cadastrado";
  const emptyText =
    loaded?.notice ??
    (filters.search
      ? "Confira a grafia ou tire alguns filtros. A busca ignora maiúsculas, minúsculas e acentos."
      : filtered
        ? "Tire alguns filtros para ver mais jogadores."
        : "Com o banco recém-criado, a lista começa vazia.");

  return (
    <AppShell
      sidebar={sidebar}
      crumbs={[{ label: "Mercado" }, { label: "Jogadores" }]}
      activeSection="jogadores"
      onRefresh={manualRefresh}
      refreshing={loading}
    >
      <div className="mx-auto max-w-[1180px]">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#155DFC]/25 bg-[#155DFC]/5 text-[#155DFC]">
              <Users size={18} strokeWidth={1.7} />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold leading-7 tracking-tight">
                Jogadores
              </h1>
              <p className="text-[12px] text-neutral-500">
                Cadastre jogadores, acompanhe os indicadores e compre os que
                estão livres.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDialog({ kind: "create" })}
            className={btnPrimary}
          >
            <Plus size={14} strokeWidth={1.9} />
            Novo jogador
          </button>
        </div>

        {/* Filtros */}
        <div className="mt-5 flex flex-nowrap items-center gap-2">
          <label className="relative min-w-[140px] flex-1">
            <Search
              size={14}
              strokeWidth={1.7}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome"
              aria-label="Buscar por nome"
              className={`${inputClass} pl-8`}
            />
          </label>

          <SelectFilter
            icon={Shirt}
            label="Posição"
            value={filters.position}
            onChange={(position) => patch({ position })}
            options={Object.entries(POSICOES).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          <SelectFilter
            icon={HeartPulse}
            label="Condição"
            activeWidth="w-[190px]"
            value={filters.condition}
            onChange={(condition) => patch({ condition })}
            options={Object.entries(CONDICOES).map(([value, { label }]) => ({
              value,
              label,
            }))}
          />

          <SelectFilter
            icon={Shield}
            label="Clube"
            value={filters.tab === "free" ? "" : filters.club}
            onChange={(club) => patch({ club })}
            disabled={filters.tab === "free"}
            options={[
              { value: "free", label: "Livre" },
              ...sidebar.clubs.map((c) => ({
                value: String(c.id),
                label: c.name,
              })),
            ]}
          />

          <RangeFilter
            icon={UserRound}
            label="Idade"
            bounds={{ min: 16, max: 45 }}
            step={1}
            min={filters.ageMin}
            max={filters.ageMax}
            format={String}
            onApply={(ageMin, ageMax) => patch({ ageMin, ageMax })}
          />

          <RangeFilter
            icon={Coins}
            label="Valor de mercado"
            activeLabel="Valor"
            width="w-[180px]"
            activeWidth="w-[175px]"
            bounds={{ min: 0 }}
            step={0.01}
            min={filters.valueMin}
            max={filters.valueMax}
            format={formatMoney}
            onApply={(valueMin, valueMax) => patch({ valueMin, valueMax })}
          />
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] py-3 ">
            <span className="text-neutral-500">
              {filters.search && chips.length === 1
                ? "Resultados para a busca:"
                : "Filtros ativos:"}
            </span>
            {chips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 shadow-sm"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remover filtro ${chip.label}`}
                  onClick={() => {
                    if ("search" in chip.clear) setSearchInput("");
                    patch(chip.clear);
                  }}
                  className="text-neutral-500 hover:text-neutral-900"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="font-medium text-[#155DFC] hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}

        {/* Tabela */}
        {loaded?.error ? (
          <div className="mt-4">
            <ErrorCard
              what="os jogadores"
              message={loaded.error}
              onRetry={refresh}
              retrying={loading}
            />
          </div>
        ) : loaded && players.length === 0 ? (
          <div className="mt-4">
            <StateCard
              icon={filtered ? SearchX : Users}
              title={emptyTitle}
              description={emptyText}
            >
              {filtered ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={stateButtonClass}
                >
                  <X size={14} strokeWidth={1.8} />
                  Limpar filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "create" })}
                  className={stateButtonClass}
                >
                  <Plus size={14} strokeWidth={1.8} />
                  Novo jogador
                </button>
              )}
            </StateCard>
          </div>
        ) : (
          <section className="mt-4 rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2.5">
              {!loaded ? (
                <>
                  <LoadingLabel label="Carregando jogadores…" />
                  <SkeletonBar className="h-8 w-[190px] rounded-lg" />
                </>
              ) : (
                <>
                  <div
                    role="tablist"
                    aria-label="Situação"
                    className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 text-[12px]"
                  >
                    {(
                      [
                        ["all", "Todos", counts.all],
                        ["free", "Livres", counts.free],
                        ["clubs", "Em clubes", counts.clubs],
                      ] as const
                    ).map(([key, label, count]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={filters.tab === key}
                        onClick={() => patch({ tab: key })}
                        className={`rounded-md px-2.5 py-1 transition ${
                          filters.tab === key
                            ? "bg-white font-medium shadow-sm ring-1 ring-neutral-200"
                            : "text-neutral-600 hover:text-neutral-950"
                        }`}
                      >
                        {label}{" "}
                        <span className="ml-0.5 text-neutral-500">{count}</span>
                      </button>
                    ))}
                  </div>

                  <div
                    className="relative"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-expanded={sortOpen}
                      onClick={() => {
                        setMenu(null);
                        setSortOpen((open) => !open);
                      }}
                      className="flex h-8 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-[12px] shadow-sm hover:bg-neutral-50"
                    >
                      <ArrowUpDown size={13} strokeWidth={1.7} />
                      Ordenar: {SORTS[filters.sort].label}
                      <ChevronDown size={12} strokeWidth={1.7} />
                    </button>
                    {sortOpen && (
                      <div className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                        {(Object.keys(SORTS) as SortKey[]).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              patch({ sort: key });
                              setSortOpen(false);
                            }}
                            className={`flex w-full rounded-md px-3 py-2 text-left text-[12px] hover:bg-neutral-100 ${
                              filters.sort === key
                                ? "bg-[#155DFC]/5 font-medium text-[#155DFC]"
                                : ""
                            }`}
                          >
                            {SORTS[key].label.charAt(0).toUpperCase() +
                              SORTS[key].label.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div
              className={`overflow-x-auto transition-opacity ${loading && loaded ? "opacity-60" : ""}`}
            >
              <table className="w-full min-w-[1040px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-neutral-50 text-[12px] text-neutral-500">
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left font-normal"
                    >
                      Jogador
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2.5 text-left font-normal"
                    >
                      Posição
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2.5 text-right font-normal"
                    >
                      Overall
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left font-normal"
                    >
                      Agilidade
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2.5 text-right font-normal"
                    >
                      Idade
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left font-normal"
                    >
                      Condição
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-normal"
                    >
                      Valor base
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-normal"
                    >
                      Valor de mercado
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left font-normal"
                    >
                      Clube
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!loaded
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <tr
                          key={i}
                          aria-hidden
                          className="border-t border-neutral-200"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <SkeletonBar className="h-8 w-8 rounded-full" />
                              <SkeletonBar className="h-3 w-24" />
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <SkeletonBar className="h-5 w-11 rounded-md" />
                          </td>
                          <td className="px-2 py-3">
                            <SkeletonBar className="ml-auto h-3 w-6" />
                          </td>
                          <td className="px-3 py-3">
                            <SkeletonBar className="h-3 w-16" />
                          </td>
                          <td className="px-2 py-3">
                            <SkeletonBar className="ml-auto h-3 w-6" />
                          </td>
                          <td className="px-3 py-3">
                            <SkeletonBar className="h-5 w-24 rounded-full" />
                          </td>
                          <td className="px-3 py-3">
                            <SkeletonBar className="ml-auto h-3 w-14" />
                          </td>
                          <td className="px-3 py-3">
                            <SkeletonBar className="ml-auto h-3 w-16" />
                          </td>
                          <td className="px-3 py-3">
                            <SkeletonBar className="h-3 w-20" />
                          </td>
                          <td className="px-3 py-3">
                            <SkeletonBar className="ml-auto h-8 w-8 rounded-lg" />
                          </td>
                        </tr>
                      ))
                    : players.map((player) => {
                        const status = CONDICOES[player.condition];
                        const club =
                          player.club_id === null
                            ? null
                            : clubsById.get(player.club_id);
                        return (
                          <tr
                            key={player.id}
                            className={`border-t border-neutral-200 transition-colors ${highlightId === player.id ? "bg-[#155DFC]/5" : "hover:bg-neutral-50/60"}`}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar
                                  id={player.id}
                                  name={player.name}
                                  size={32}
                                />
                                <div className="leading-tight">
                                  <p className="whitespace-nowrap font-medium">
                                    {player.name}
                                  </p>
                                  <p className="text-[11px] text-neutral-500">
                                    {POSICOES[player.position] ??
                                      player.position}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <span className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium">
                                {player.position}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right font-semibold tabular-nums">
                              {player.overall}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="w-6 text-right tabular-nums">
                                  {player.agility}
                                </span>
                                <span className="h-1.5 w-10 overflow-hidden rounded-full bg-neutral-200">
                                  <span
                                    className="block h-full rounded-full"
                                    style={{
                                      width: `${Math.max(0, Math.min(100, player.agility))}%`,
                                      background:
                                        player.agility >= 75
                                          ? "#168344"
                                          : player.agility < 35
                                            ? "#dc3545"
                                            : "#777b89",
                                    }}
                                  />
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {player.age}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                                style={{
                                  color: status.color,
                                  background: status.bg,
                                  border: `1px solid ${status.color}25`,
                                }}
                              >
                                <span aria-hidden className="text-[8px]">
                                  ●
                                </span>
                                {status.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                              {formatMoney(player.base_value)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatMoney(player.market_value)}
                            </td>
                            <td className="px-3 py-2">
                              {player.club_id === null ? (
                                <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium">
                                  Livre
                                </span>
                              ) : (
                                <Link
                                  href={`/clubes/${player.club_id}`}
                                  onClick={clearFilters}
                                  className="flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  {club && (
                                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold">
                                      {club.acronym}
                                    </span>
                                  )}
                                  <span className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-700">
                                    {club?.name ?? `Clube #${player.club_id}`}
                                  </span>
                                </Link>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {player.club_id === null && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDialog({ kind: "buy", player })
                                    }
                                    className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 text-[12px] font-medium shadow-sm hover:bg-neutral-50"
                                  >
                                    <ShoppingCart size={13} strokeWidth={1.7} />
                                    Comprar
                                  </button>
                                )}
                                <div
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    aria-label={`Mais ações para ${player.name}`}
                                    aria-haspopup="menu"
                                    aria-expanded={
                                      menu?.player.id === player.id
                                    }
                                    onClick={(event) =>
                                      openMenu(player, event.currentTarget)
                                    }
                                    className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
                                  >
                                    <MoreHorizontal size={15} />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {loaded && (
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-[12px] text-neutral-500">
                <span>
                  Mostrando {from}–{to} de {total}{" "}
                  {total === 1 ? "jogador" : "jogadores"}
                </span>
                <nav aria-label="Paginação" className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={filters.page <= 1 || loading}
                    onClick={() =>
                      setFilters((c) => ({ ...c, page: c.page - 1 }))
                    }
                    className="flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-neutral-950 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} /> Anterior
                  </button>
                  {Array.from(
                    { length: Math.min(totalPages, 3) },
                    (_, index) => {
                      const start = Math.max(
                        1,
                        Math.min(filters.page - 1, totalPages - 2),
                      );
                      const number = start + index;
                      return (
                        <button
                          key={number}
                          type="button"
                          aria-current={
                            filters.page === number ? "page" : undefined
                          }
                          onClick={() =>
                            setFilters((c) => ({ ...c, page: number }))
                          }
                          className={`h-7 min-w-7 rounded-md px-2 ${filters.page === number ? "border border-neutral-200 bg-white font-medium text-neutral-950 shadow-sm" : "hover:bg-neutral-100"}`}
                        >
                          {number}
                        </button>
                      );
                    },
                  )}
                  <button
                    type="button"
                    disabled={filters.page >= totalPages || loading}
                    onClick={() =>
                      setFilters((c) => ({ ...c, page: c.page + 1 }))
                    }
                    className="flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-neutral-950 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    Próxima <ChevronRight size={15} />
                  </button>
                </nav>
              </footer>
            )}
          </section>
        )}

        <p className="mt-3 text-[11px] leading-4 text-neutral-500">
          Overall e valor de mercado são calculados a cada consulta. A busca
          ignora maiúsculas, minúsculas e acentos.
        </p>
      </div>

      {/* Diálogos */}
      {dialog?.kind === "create" && (
        <PlayerFormModal
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            flash(saved.id);
            setDialog({ kind: "created", player: saved });
            refresh();
          }}
        />
      )}
      {dialog?.kind === "created" && (
        <PlayerCreatedModal
          player={{
            name: dialog.player.name,
            conditionLabel: CONDICOES[dialog.player.condition].label,
            positionLabel: POSICOES[dialog.player.position],
            clubName: null,
            baseValue: dialog.player.base_value,
            marketValue: dialog.player.market_value,
            overall: dialog.player.overall,
          }}
          onClose={() => setDialog(null)}
          onViewDetails={() => {
            setDrawer(dialog.player);
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "edit" && (
        <PlayerFormModal
          player={dialog.player}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            flash(saved.id);
            done(
              "Jogador atualizado",
              `${saved.name} · valor de mercado: ${formatMoney(saved.market_value)}.`,
            );
          }}
        />
      )}
      {dialog?.kind === "condition" && (
        <ConditionModal
          player={dialog.player}
          clubName={
            dialog.player.club_id === null
              ? undefined
              : clubsById.get(dialog.player.club_id)?.name
          }
          onClose={() => setDialog(null)}
          onChanged={(condition, marketValue) => {
            flash(dialog.player.id);
            done(
              "Condição alterada",
              `${dialog.player.name} agora está ${CONDICOES[condition].label}.` +
                (marketValue !== undefined
                  ? ` Valor de mercado: ${formatMoney(marketValue)}.`
                  : ""),
            );
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeletePlayerModal
          player={dialog.player}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDrawer(null);
            done(
              "Jogador excluído",
              `${dialog.player.name} saiu da lista. Transações e partidas antigas dele continuam gravadas.`,
            );
          }}
        />
      )}
      {dialog?.kind === "buy" && (
        <BuyModal
          player={dialog.player}
          clubs={sidebar.clubs}
          onClose={() => setDialog(null)}
          onBought={(data) => {
            setDialog({ kind: "bought", data });
            refresh();
          }}
        />
      )}
      {dialog?.kind === "bought" && (
        <PurchaseDoneModal data={dialog.data} onClose={() => setDialog(null)} />
      )}

      {drawer && (
        <PlayerDrawer
          player={players.find((item) => item.id === drawer.id) ?? drawer}
          club={
            drawer.club_id === null ? undefined : clubsById.get(drawer.club_id)
          }
          onClose={() => setDrawer(null)}
          onEdit={() =>
            setDialog({
              kind: "edit",
              player: players.find((item) => item.id === drawer.id) ?? drawer,
            })
          }
          onCondition={() =>
            setDialog({
              kind: "condition",
              player: players.find((item) => item.id === drawer.id) ?? drawer,
            })
          }
          onBuy={() =>
            setDialog({
              kind: "buy",
              player: players.find((item) => item.id === drawer.id) ?? drawer,
            })
          }
        />
      )}

      {menu && (
        <PlayerMenu
          menu={menu}
          onPick={(action) => {
            const { player } = menu;
            setMenu(null);
            if (action === "details") setDrawer(player);
            else setDialog({ kind: action, player });
          }}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function rangeText(
  min: number | undefined,
  max: number | undefined,
  fmt: (n: number) => string,
) {
  if (min !== undefined && max !== undefined)
    return `${fmt(min)} a ${fmt(max)}`;
  if (min !== undefined) return `a partir de ${fmt(min)}`;
  return `até ${fmt(max as number)}`;
}

function SelectFilter({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  disabled = false,
  width = "w-[120px]",
  activeWidth = "w-[170px]",
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  /** Largura sem valor escolhido e com valor escolhido (mostra "Rótulo: valor"). */
  width?: string;
  activeWidth?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={`relative shrink-0 ${value ? activeWidth : width}`}>
      <Icon
        size={14}
        strokeWidth={1.7}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
      />
      <select
        aria-label={label}
        disabled={disabled}
        title={
          disabled
            ? "Com a aba “Livres” ativa, o filtro por clube fica desabilitado."
            : undefined
        }
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} appearance-none pl-8 pr-7 [&>option]:text-neutral-900 ${value ? "!border-neutral-500 text-transparent" : "text-neutral-600"}`}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {value && (
        <span className="pointer-events-none absolute inset-y-0 left-8 right-7 flex items-center truncate text-[13px] text-neutral-950">
          {label}: {options.find((option) => option.value === value)?.label}
        </span>
      )}
      <ChevronDown
        size={12}
        strokeWidth={1.7}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
      />
    </label>
  );
}

/** Filtro de faixa (mínimo e máximo) em um pequeno painel. */
function RangeFilter({
  icon: Icon,
  label,
  activeLabel,
  width = "w-[105px]",
  activeWidth = "w-[140px]",
  bounds,
  step,
  min,
  max,
  format,
  onApply,
}: {
  icon: LucideIcon;
  label: string;
  /** Texto quando o filtro está ativo (ex.: "Valor"). */
  activeLabel?: string;
  width?: string;
  activeWidth?: string;
  bounds: { min: number; max?: number };
  step: number;
  min?: number;
  max?: number;
  format: (n: number) => string;
  onApply: (min: number | undefined, max: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    if (!open) {
      setLow(min === undefined ? "" : String(min));
      setHigh(max === undefined ? "" : String(max));
      setError("");
    }
    setOpen((value) => !value);
  }

  function apply() {
    const parse = (text: string) =>
      text.trim() === "" ? undefined : Number(text.replace(",", "."));
    const a = parse(low);
    const b = parse(high);
    const invalid = (n: number | undefined) =>
      n !== undefined &&
      (Number.isNaN(n) ||
        n < bounds.min ||
        (bounds.max !== undefined && n > bounds.max));
    if (invalid(a) || invalid(b))
      return setError(
        bounds.max !== undefined
          ? `Use valores de ${bounds.min} a ${bounds.max}.`
          : "Informe valores válidos.",
      );
    if (a !== undefined && b !== undefined && a > b)
      return setError("O mínimo não pode ser maior que o máximo.");
    onApply(a, b);
    setOpen(false);
  }

  const active = min !== undefined || max !== undefined;

  return (
    <div
      ref={ref}
      className={`relative shrink-0 ${active ? activeWidth : width}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={`${inputClass} flex items-center gap-2 text-left ${active ? "!border-neutral-500" : "text-neutral-600"}`}
      >
        <Icon
          size={14}
          strokeWidth={1.7}
          className="shrink-0 text-neutral-500"
        />
        <span className="flex-1 truncate">
          {active
            ? `${activeLabel ?? label}: ${rangeText(min, max, format)}`
            : label}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={1.7}
          className="shrink-0 text-neutral-500"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium">
              Mínimo
              <input
                inputMode="decimal"
                step={step}
                value={low}
                onChange={(e) => setLow(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-[11px] font-medium">
              Máximo
              <input
                inputMode="decimal"
                step={step}
                value={high}
                onChange={(e) => setHigh(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onApply(undefined, undefined);
                setOpen(false);
              }}
              className={`${btnSecondary} h-8 px-3 text-[12px]`}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={apply}
              className={`${btnPrimary} h-8 px-3 text-[12px]`}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type MenuAction = "details" | "edit" | "condition" | "buy" | "delete";

/** Menu de ações do jogador, fixo na tela para não ser cortado pela tabela. */
function PlayerMenu({
  menu,
  onPick,
}: {
  menu: { player: Jogador; right: number; top?: number; bottom?: number };
  onPick: (action: MenuAction) => void;
}) {
  const { player } = menu;
  const free = player.club_id === null;

  const item = (action: MenuAction, label: string, Icon: LucideIcon) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => onPick(action)}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-neutral-100"
    >
      <Icon size={15} strokeWidth={1.6} />
      {label}
    </button>
  );

  return (
    <div
      role="menu"
      aria-label={`Ações de ${player.name}`}
      onClick={(event) => event.stopPropagation()}
      style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}
      className="fixed z-40 w-[250px] rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg"
    >
      <p className="truncate px-2.5 pb-1 pt-1.5 text-[12px] text-neutral-500">
        {player.name}
      </p>
      {item("details", "Ver detalhes", Eye)}
      {item("edit", "Editar", Pencil)}
      {item("condition", "Alterar condição", HeartPulse)}

      {free && (
        <>
          <div className="my-1.5 border-t border-neutral-200" />
          {item("buy", "Comprar", ShoppingCart)}
        </>
      )}

      <div className="my-1.5 border-t border-neutral-200" />
      <button
        type="button"
        role="menuitem"
        disabled={!free}
        onClick={() => onPick("delete")}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
      >
        <Trash2 size={15} strokeWidth={1.6} />
        Excluir
      </button>
      <p className="px-2.5 pb-1.5 text-[12px] leading-4 text-neutral-500">
        {free
          ? "Disponível porque o jogador está livre."
          : "Indisponível: o jogador está em um clube."}
      </p>
    </div>
  );
}