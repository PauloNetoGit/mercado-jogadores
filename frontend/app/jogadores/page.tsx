"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Coins,
  HeartPulse,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  Shirt,
  ShoppingCart,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppShell, useSidebarData } from "@/src/components/AppShell";
import { Toast, type ToastData } from "@/src/components/Toast";
import { BuyModal } from "@/src/components/players/BuyModal";
import { ConditionModal } from "@/src/components/players/ConditionModal";
import { DeletePlayerModal } from "@/src/components/players/DeletePlayerModal";
import { PlayerFormModal } from "@/src/components/players/PlayerFormModal";
import { btnPrimary, btnSecondary, inputClass } from "@/src/components/Modal";
import {
  CONDICOES,
  LIMITE_API,
  POSICOES,
  playersService,
  type FiltrosJogadores,
} from "@/src/services/players";
import type { Jogador } from "@/src/types";
import { formatMoney } from "@/src/utils/format";

const PAGE_SIZE = 10;

type Tab = "all" | "free" | "clubs";

const SORTS = {
  "name:asc": { label: "nome", sort_by: "name", order: "asc" },
  "market_value:desc": { label: "maior valor de mercado", sort_by: "market_value", order: "desc" },
  "market_value:asc": { label: "menor valor de mercado", sort_by: "market_value", order: "asc" },
  "age:desc": { label: "maior idade", sort_by: "age", order: "desc" },
  "age:asc": { label: "menor idade", sort_by: "age", order: "asc" },
  "position:asc": { label: "posição (GOL a ATA)", sort_by: "position", order: "asc" },
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

/** Busca a lista respeitando os filtros. O valor de mercado não é filtrável na API, então
 *  esse filtro baixa todas as páginas (100 por vez) e pagina aqui mesmo. */
async function loadList(f: Filters): Promise<Result> {
  const { sort_by, order } = SORTS[f.sort];
  const base = {
    search: f.search || undefined,
    position: f.position || undefined,
    condition: f.condition || undefined,
    age_min: f.ageMin,
    age_max: f.ageMax,
    sort_by,
    order,
  } satisfies Partial<FiltrosJogadores>;

  const specificClub = f.club !== "" && f.club !== "free";
  const clubParams: Partial<FiltrosJogadores> =
    f.club === "free" ? { free: "true" } : specificClub ? { club_id: Number(f.club) } : {};

  if (f.tab === "free" && specificClub)
    return { ...EMPTY_RESULT, notice: "“Livres” não combina com o filtro por clube." };
  if (f.tab === "clubs" && f.club === "free")
    return { ...EMPTY_RESULT, notice: "“Em clubes” não combina com o filtro “Livre”." };

  const query = (extra: Partial<FiltrosJogadores>, page: number, limit: number) =>
    playersService.list({ ...base, ...clubParams, ...extra, page, limit });

  // --- Com filtro de valor: baixa tudo e filtra/pagina localmente. ---
  if (f.valueMin !== undefined || f.valueMax !== undefined) {
    const first = await query({}, 1, LIMITE_API);
    let all = first.data;
    for (let page = 2; page <= first.meta.total_pages; page++) {
      all = all.concat((await query({}, page, LIMITE_API)).data);
    }
    all = all.filter(
      (p) =>
        (f.valueMin === undefined || p.market_value >= f.valueMin) &&
        (f.valueMax === undefined || p.market_value <= f.valueMax),
    );
    const counts = {
      all: all.length,
      free: all.filter((p) => p.club_id === null).length,
      clubs: all.filter((p) => p.club_id !== null).length,
    };
    const visible =
      f.tab === "free" ? all.filter((p) => p.club_id === null)
      : f.tab === "clubs" ? all.filter((p) => p.club_id !== null)
      : all;
    const start = (f.page - 1) * PAGE_SIZE;
    return {
      players: visible.slice(start, start + PAGE_SIZE),
      total: visible.length,
      totalPages: Math.max(1, Math.ceil(visible.length / PAGE_SIZE)),
      counts,
    };
  }

  // --- Sem filtro de valor: a API pagina e ordena. ---
  const tabParam: Partial<FiltrosJogadores> =
    f.club === "free" ? {} : f.tab === "free" ? { free: "true" } : f.tab === "clubs" ? { free: "false" } : {};

  const [list, all, free, clubs] = await Promise.all([
    query(tabParam, f.page, PAGE_SIZE),
    query({}, 1, 1),
    specificClub ? Promise.resolve(null) : query({ free: "true" }, 1, 1),
    specificClub || f.club === "free" ? Promise.resolve(null) : query({ free: "false" }, 1, 1),
  ]);

  return {
    players: list.data,
    total: list.meta.total,
    totalPages: Math.max(1, list.meta.total_pages),
    counts: {
      all: all.meta.total,
      free: specificClub ? 0 : (free?.meta.total ?? all.meta.total),
      clubs: f.club === "free" ? 0 : specificClub ? all.meta.total : (clubs?.meta.total ?? 0),
    },
  };
}

/* -------------------------------------------------------------------------- */

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; player: Jogador }
  | { kind: "condition"; player: Jogador }
  | { kind: "delete"; player: Jogador }
  | { kind: "buy"; player: Jogador };

export default function JogadoresPage() {
  const sidebar = useSidebarData();
  const reloadSidebar = sidebar.reload;

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [token, setToken] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const request = useMemo(() => ({ filters, token }), [filters, token]);
  const loading = loaded?.request !== request;

  // Busca por nome com atraso, para não chamar a API a cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();
      setFilters((current) =>
        current.search === value ? current : { ...current, search: value, page: 1 },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    loadList(request.filters)
      .then((result) => !cancelled && setLoaded({ request, ...result }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setLoaded({
            request,
            ...EMPTY_RESULT,
            error: err instanceof Error ? err.message : "Não foi possível carregar os jogadores.",
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [request]);

  // Fecha menus ao clicar fora.
  useEffect(() => {
    if (!sortOpen && menuFor === null) return;
    function close() {
      setSortOpen(false);
      setMenuFor(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [sortOpen, menuFor]);

  const closeToast = useCallback(() => setToast(null), []);

  function patch(next: Partial<Filters>) {
    setFilters((current) => ({ ...current, page: 1, ...next }));
  }

  function clearFilters() {
    setSearchInput("");
    setFilters({ ...INITIAL_FILTERS, sort: filters.sort });
  }

  function refresh() {
    setToken((value) => value + 1);
    reloadSidebar();
  }

  function notify(title: string, description?: string, variant: "success" | "error" = "success") {
    setToast({ id: Date.now(), title, description, variant });
  }

  function done(title: string, description?: string) {
    setDialog(null);
    notify(title, description);
    refresh();
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
  if (filters.search) chips.push({ label: `Busca: ${filters.search}`, clear: { search: "" } });
  if (filters.position) chips.push({ label: `Posição: ${POSICOES[filters.position as keyof typeof POSICOES] ?? filters.position}`, clear: { position: "" } });
  if (filters.condition) chips.push({ label: `Condição: ${CONDICOES[filters.condition as keyof typeof CONDICOES]?.label}`, clear: { condition: "" } });
  if (filters.club)
    chips.push({
      label: `Clube: ${filters.club === "free" ? "Livre" : (clubsById.get(Number(filters.club))?.name ?? `#${filters.club}`)}`,
      clear: { club: "" },
    });
  if (filters.ageMin !== undefined || filters.ageMax !== undefined)
    chips.push({ label: `Idade: ${rangeText(filters.ageMin, filters.ageMax, String)}`, clear: { ageMin: undefined, ageMax: undefined } });
  if (filters.valueMin !== undefined || filters.valueMax !== undefined)
    chips.push({ label: `Valor de mercado: ${rangeText(filters.valueMin, filters.valueMax, formatMoney)}`, clear: { valueMin: undefined, valueMax: undefined } });

  const from = players.length ? (filters.page - 1) * PAGE_SIZE + 1 : 0;
  const to = (filters.page - 1) * PAGE_SIZE + players.length;

  return (
    <AppShell
      sidebar={sidebar}
      crumbs={[{ label: "Mercado" }, { label: "Jogadores" }]}
      activeSection="jogadores"
      onRefresh={refresh}
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
              <h1 className="text-[20px] font-semibold leading-7 tracking-tight">Jogadores</h1>
              <p className="text-[12px] text-neutral-500">
                Cadastre jogadores, acompanhe os indicadores e compre os que estão livres.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setDialog({ kind: "create" })} className={btnPrimary}>
            <Plus size={14} strokeWidth={1.9} />
            Novo jogador
          </button>
        </div>

        {/* Filtros */}
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1.6fr)_repeat(5,minmax(0,1fr))]">
          <label className="relative">
            <Search size={14} strokeWidth={1.7} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome"
              aria-label="Buscar por nome"
              className={`${inputClass} pl-8`}
            />
          </label>

          <SelectFilter icon={Shirt} label="Posição" value={filters.position} onChange={(position) => patch({ position })}
            options={Object.entries(POSICOES).map(([value, label]) => ({ value, label }))} />

          <SelectFilter icon={HeartPulse} label="Condição" value={filters.condition} onChange={(condition) => patch({ condition })}
            options={Object.entries(CONDICOES).map(([value, { label }]) => ({ value, label }))} />

          <SelectFilter icon={Shield} label="Clube" value={filters.club} onChange={(club) => patch({ club })}
            options={[{ value: "free", label: "Livre" }, ...sidebar.clubs.map((c) => ({ value: String(c.id), label: c.name }))]} />

          <RangeFilter icon={UserRound} label="Idade" bounds={{ min: 16, max: 45 }} step={1}
            min={filters.ageMin} max={filters.ageMax} format={String}
            onApply={(ageMin, ageMax) => patch({ ageMin, ageMax })} />

          <RangeFilter icon={Coins} label="Valor de mercado" bounds={{ min: 0 }} step={0.01}
            min={filters.valueMin} max={filters.valueMax} format={formatMoney}
            onApply={(valueMin, valueMax) => patch({ valueMin, valueMax })} />
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-neutral-500">
              {filters.search && chips.length === 1 ? "Resultados para a busca:" : "Filtros ativos:"}
            </span>
            {chips.map((chip) => (
              <span key={chip.label} className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 shadow-sm">
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
            <button type="button" onClick={clearFilters} className="font-medium text-[#155DFC] hover:underline">
              Limpar filtros
            </button>
          </div>
        )}

        {/* Tabela */}
        <section className="mt-4 rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2.5">
            <div role="tablist" aria-label="Situação" className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 text-[12px]">
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
                    filters.tab === key ? "bg-white font-medium shadow-sm ring-1 ring-neutral-200" : "text-neutral-600 hover:text-neutral-950"
                  }`}
                >
                  {label} <span className="ml-0.5 text-neutral-500">{count}</span>
                </button>
              ))}
            </div>

            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                aria-expanded={sortOpen}
                onClick={() => {
                  setMenuFor(null);
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
                        filters.sort === key ? "bg-[#155DFC]/5 font-medium text-[#155DFC]" : ""
                      }`}
                    >
                      {SORTS[key].label.charAt(0).toUpperCase() + SORTS[key].label.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loaded?.error && (
            <div role="alert" className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              <CircleAlert size={16} className="shrink-0" />
              <span className="flex-1">{loaded.error}</span>
              <button type="button" onClick={refresh} className="font-medium underline underline-offset-2">
                Tentar novamente
              </button>
            </div>
          )}

          <div className={`overflow-x-auto transition-opacity ${loading && loaded ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[1040px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-neutral-50 text-[12px] text-neutral-500">
                  <th scope="col" className="px-4 py-2.5 text-left font-normal">Jogador</th>
                  <th scope="col" className="px-2 py-2.5 text-left font-normal">Posição</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-normal">Overall</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">Agilidade</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-normal">Idade</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">Condição</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-normal">Valor base</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-normal">Valor de mercado</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">Clube</th>
                  <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {!loaded ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-neutral-200">
                      <td colSpan={10} className="px-4 py-3.5"><div className="h-3 animate-pulse rounded bg-neutral-100" /></td>
                    </tr>
                  ))
                ) : players.length === 0 && !loaded.error ? (
                  <tr className="border-t border-neutral-200">
                    <td colSpan={10} className="px-4 py-14 text-center text-[13px] text-neutral-500">
                      {loaded.notice ?? "Nenhum jogador encontrado com esses filtros."}
                      {chips.length > 0 || filters.tab !== "all" ? (
                        <button type="button" onClick={clearFilters} className="ml-2 font-medium text-[#155DFC] hover:underline">
                          Limpar filtros
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  players.map((player) => {
                    const status = CONDICOES[player.condition];
                    const club = player.club_id === null ? null : clubsById.get(player.club_id);
                    const initials = player.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
                    return (
                      <tr key={player.id} className="border-t border-neutral-200 hover:bg-neutral-50/60">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600">{initials}</span>
                            <div className="leading-tight">
                              <p className="whitespace-nowrap font-medium">{player.name}</p>
                              <p className="text-[11px] text-neutral-500">{POSICOES[player.position] ?? player.position}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <span className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium">{player.position}</span>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{player.overall}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 text-right tabular-nums">{player.agility}</span>
                            <span className="h-1.5 w-10 overflow-hidden rounded-full bg-neutral-200">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${Math.max(0, Math.min(100, player.agility))}%`,
                                  background: player.agility >= 75 ? "#168344" : player.agility < 35 ? "#dc3545" : "#777b89",
                                }}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{player.age}</td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ color: status.color, background: status.bg, border: `1px solid ${status.color}25` }}
                          >
                            <span aria-hidden className="text-[8px]">●</span>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{formatMoney(player.base_value)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(player.market_value)}</td>
                        <td className="px-3 py-2">
                          {player.club_id === null ? (
                            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium">Livre</span>
                          ) : (
                            <Link href={`/clubes/${player.club_id}`} className="flex items-center gap-1.5 whitespace-nowrap">
                              {club && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold">{club.acronym}</span>}
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
                                onClick={() => setDialog({ kind: "buy", player })}
                                className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 text-[12px] font-medium shadow-sm hover:bg-neutral-50"
                              >
                                <ShoppingCart size={13} strokeWidth={1.7} />
                                Comprar
                              </button>
                            )}
                            <div className="relative" onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                aria-label={`Mais ações para ${player.name}`}
                                aria-expanded={menuFor === player.id}
                                onClick={() => {
                                  setSortOpen(false);
                                  setMenuFor((current) => (current === player.id ? null : player.id));
                                }}
                                className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                              {menuFor === player.id && (
                                <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                                  {([
                                    ["Editar jogador", () => setDialog({ kind: "edit", player })],
                                    ["Alterar condição física", () => setDialog({ kind: "condition", player })],
                                    ["Excluir jogador", () => setDialog({ kind: "delete", player })],
                                  ] as const).map(([label, action]) => (
                                    <button
                                      key={label}
                                      type="button"
                                      onClick={() => {
                                        setMenuFor(null);
                                        action();
                                      }}
                                      className={`w-full rounded-md px-3 py-2 text-left text-[12px] hover:bg-neutral-100 ${label.startsWith("Excluir") ? "text-red-600" : ""}`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-[12px] text-neutral-500">
            <span>
              Mostrando {from}–{to} de {total} {total === 1 ? "jogador" : "jogadores"}
            </span>
            <nav aria-label="Paginação" className="flex items-center gap-1">
              <button type="button" disabled={filters.page <= 1 || loading} onClick={() => setFilters((c) => ({ ...c, page: c.page - 1 }))} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-neutral-100 disabled:opacity-40">
                <ChevronLeft size={15} /> Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => {
                const start = Math.max(1, Math.min(filters.page - 1, totalPages - 2));
                const number = start + index;
                return (
                  <button
                    key={number}
                    type="button"
                    aria-current={filters.page === number ? "page" : undefined}
                    onClick={() => setFilters((c) => ({ ...c, page: number }))}
                    className={`h-7 min-w-7 rounded-md px-2 ${filters.page === number ? "border border-neutral-200 bg-white font-medium text-neutral-950 shadow-sm" : "hover:bg-neutral-100"}`}
                  >
                    {number}
                  </button>
                );
              })}
              <button type="button" disabled={filters.page >= totalPages || loading} onClick={() => setFilters((c) => ({ ...c, page: c.page + 1 }))} className="flex items-center gap-1 rounded-md px-2 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-40">
                Próxima <ChevronRight size={15} />
              </button>
            </nav>
          </footer>
        </section>
      </div>

      {/* Diálogos */}
      {dialog?.kind === "create" && (
        <PlayerFormModal
          onClose={() => setDialog(null)}
          onSaved={(saved) => done("Jogador cadastrado", `${saved.name} entrou livre e Apto. Valores calculados pela API.`)}
        />
      )}
      {dialog?.kind === "edit" && (
        <PlayerFormModal
          player={dialog.player}
          onClose={() => setDialog(null)}
          onSaved={(saved) => done("Jogador atualizado", saved.name)}
        />
      )}
      {dialog?.kind === "condition" && (
        <ConditionModal
          player={dialog.player}
          onClose={() => setDialog(null)}
          onChanged={(condition) => done("Condição alterada", `${dialog.player.name}: ${CONDICOES[condition].label}.`)}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeletePlayerModal
          player={dialog.player}
          onClose={() => setDialog(null)}
          onDeleted={() => done("Jogador excluído", dialog.player.name)}
        />
      )}
      {dialog?.kind === "buy" && (
        <BuyModal
          player={dialog.player}
          clubs={sidebar.clubs}
          onClose={() => setDialog(null)}
          // O modal segue aberto mostrando o resumo da compra ("Compra concluída");
          // por isso aqui não se usa done(), que fecharia o diálogo.
          onBought={(result, clubName) => {
            notify(`${dialog.player.name} contratado`, `${clubName} · caixa agora ${formatMoney(result.club_cash)} moedas.`);
            refresh();
          }}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function rangeText(min: number | undefined, max: number | undefined, fmt: (n: number) => string) {
  if (min !== undefined && max !== undefined) return `${fmt(min)} a ${fmt(max)}`;
  if (min !== undefined) return `a partir de ${fmt(min)}`;
  return `até ${fmt(max as number)}`;
}

function SelectFilter({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative">
      <Icon size={14} strokeWidth={1.7} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} appearance-none pl-8 pr-7 ${value ? "" : "text-neutral-600"}`}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown size={12} strokeWidth={1.7} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
    </label>
  );
}

/** Filtro de faixa (mínimo e máximo) em um pequeno painel. */
function RangeFilter({
  icon: Icon,
  label,
  bounds,
  step,
  min,
  max,
  format,
  onApply,
}: {
  icon: LucideIcon;
  label: string;
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
    const parse = (text: string) => (text.trim() === "" ? undefined : Number(text.replace(",", ".")));
    const a = parse(low);
    const b = parse(high);
    const invalid = (n: number | undefined) =>
      n !== undefined && (Number.isNaN(n) || n < bounds.min || (bounds.max !== undefined && n > bounds.max));
    if (invalid(a) || invalid(b))
      return setError(bounds.max !== undefined ? `Use valores de ${bounds.min} a ${bounds.max}.` : "Informe valores válidos.");
    if (a !== undefined && b !== undefined && a > b) return setError("O mínimo não pode ser maior que o máximo.");
    onApply(a, b);
    setOpen(false);
  }

  const active = min !== undefined || max !== undefined;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={`${inputClass} flex items-center gap-2 text-left ${active ? "" : "text-neutral-600"}`}
      >
        <Icon size={14} strokeWidth={1.7} className="shrink-0 text-neutral-500" />
        <span className="flex-1 truncate">{active ? `${label}: ${rangeText(min, max, format)}` : label}</span>
        <ChevronDown size={12} strokeWidth={1.7} className="shrink-0 text-neutral-500" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-60 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium">
              Mínimo
              <input inputMode="decimal" step={step} value={low} onChange={(e) => setLow(e.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="text-[11px] font-medium">
              Máximo
              <input inputMode="decimal" step={step} value={high} onChange={(e) => setHigh(e.target.value)} className={`${inputClass} mt-1`} />
            </label>
          </div>
          {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => { onApply(undefined, undefined); setOpen(false); }} className={`${btnSecondary} h-8 px-3 text-[12px]`}>
              Limpar
            </button>
            <button type="button" onClick={apply} className={`${btnPrimary} h-8 px-3 text-[12px]`}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
