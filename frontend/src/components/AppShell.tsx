"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Clock3,
  ListOrdered,
  PanelLeft,
  Plus,
  RefreshCw,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { clubsService, type ResumoPartida } from "@/src/services/clubs";
import type { Clube } from "@/src/types";

/* -------------------------------------------------------------------------- */
/* Dados da barra lateral                                                      */
/* -------------------------------------------------------------------------- */

export interface SidebarData {
  clubs: Clube[];
  playersTotal: number;
  matches: ResumoPartida[];
}

/** Carrega os contadores e a lista de clubes exibidos na barra lateral. */
export function useSidebarData() {
  const [data, setData] = useState<SidebarData>({
    clubs: [],
    playersTotal: 0,
    matches: [],
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      clubsService.list("name"),
      clubsService.playersTotal(),
      clubsService.matches(),
    ]).then(([clubs, playersTotal, matches]) => {
      if (cancelled) return;
      // Falhas parciais não derrubam a barra: mantemos o último valor conhecido.
      setData((previous) => ({
        clubs: clubs.status === "fulfilled" ? clubs.value : previous.clubs,
        playersTotal:
          playersTotal.status === "fulfilled"
            ? playersTotal.value
            : previous.playersTotal,
        matches:
          matches.status === "fulfilled" ? matches.value : previous.matches,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { ...data, reload };
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                       */
/* -------------------------------------------------------------------------- */

export interface Crumb {
  label: string;
  href?: string;
}

interface AppShellProps {
  sidebar: SidebarData;
  crumbs: Crumb[];
  /** Item de navegação destacado. */
  activeSection?: "clubes" | "jogadores";
  activeClubId?: number | null;
  /** Se informado, o "+" da barra lateral abre o formulário em vez de navegar. */
  onNewClub?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}

const FONT_STACK =
  'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function AppShell({
  sidebar,
  crumbs,
  activeSection,
  activeClubId = null,
  onNewClub,
  onRefresh,
  refreshing = false,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopHidden, setDesktopHidden] = useState(false);

  const lastMatch = sidebar.matches[0];

  function toggleMenu() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDesktopHidden((value) => !value);
    } else {
      setMenuOpen((value) => !value);
    }
  }

  return (
    <div
      className="min-h-screen bg-[#fafafa] text-neutral-950"
      style={{ fontFamily: FONT_STACK }}
    >
      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      {/* ------------------------------ Barra lateral ----------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col bg-[#fafafa] transition-transform duration-200 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopHidden ? "lg:-translate-x-full" : "lg:translate-x-0"}`}
      >
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <Image
            src="/Marca.svg"
            alt="Símbolo Passe"
            width={32}
            height={32}
            priority
            className="h-8 w-8 shrink-0"
          />
          <div className="min-w-0 leading-tight">
            <span className="block text-[13px] font-semibold">Passe</span>
            <span className="block text-[11px] text-neutral-500">
              Gestão da liga
            </span>
          </div>
        </div>

        <nav
          aria-label="Navegação principal"
          className="flex-1 space-y-4 overflow-y-auto px-3 py-2 text-[13px]"
        >
          <div>
            <p className="px-2 pb-1.5 text-[11px] font-medium text-neutral-500">
              Mercado
            </p>
            <NavLink
              href="/jogadores"
              icon={<Users size={15} strokeWidth={1.7} />}
              label="Jogadores"
              count={sidebar.playersTotal}
              active={activeSection === "jogadores"}
              current={activeSection === "jogadores"}
            />
            <NavLink
              href="/clubes"
              icon={<Shield size={15} strokeWidth={1.7} />}
              label="Clubes"
              count={sidebar.clubs.length}
              active={activeSection === "clubes"}
              current={activeSection === "clubes"}
            />
          </div>

          <div>
            <p className="px-2 pb-1.5 text-[11px] font-medium text-neutral-500">
              Liga
            </p>
            <NavLink
              href="/partidas"
              icon={<Swords size={15} strokeWidth={1.7} />}
              label="Partidas"
              count={sidebar.matches.length}
            />
            <NavLink
              href="/classificacao"
              icon={<ListOrdered size={15} strokeWidth={1.7} />}
              label="Classificação"
            />
          </div>

          <div>
            <div className="flex items-center justify-between px-2 pb-1.5">
              <p className="text-[11px] font-medium text-neutral-500">Clubes</p>
              {onNewClub ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNewClub();
                  }}
                  aria-label="Novo clube"
                  className="rounded p-0.5 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-900"
                >
                  <Plus size={15} strokeWidth={1.7} />
                </button>
              ) : (
                <Link
                  href="/clubes?novo=1"
                  aria-label="Novo clube"
                  className="rounded p-0.5 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-900"
                >
                  <Plus size={15} strokeWidth={1.7} />
                </Link>
              )}
            </div>

            {sidebar.clubs.map((club) => {
              const isActive = club.id === activeClubId;
              return (
                <Link
                  key={club.id}
                  href={`/clubes/${club.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                    isActive
                      ? "border border-neutral-200 bg-white font-medium shadow-sm"
                      : "border border-transparent text-neutral-800 hover:bg-neutral-200/50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${
                      isActive
                        ? "bg-[#155DFC] text-white"
                        : "bg-neutral-200/70 text-neutral-800"
                    }`}
                  >
                    {club.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate">{club.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                <Trophy size={15} strokeWidth={1.6} />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[12px] font-semibold">
                  Liga Fictícia 2026
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {sidebar.clubs.length} clubes · {sidebar.playersTotal} jogadores
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                <Swords size={15} strokeWidth={1.6} />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-[12px] font-semibold">Última partida</p>
                <p className="truncate text-[11px] text-neutral-500">
                  {lastMatch
                    ? `${lastMatch.home.club_name} ${lastMatch.home.goals} × ${lastMatch.away.goals} ${lastMatch.away.club_name}`
                    : "Nenhuma partida"}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 border-t border-neutral-200 pt-2.5 text-[11px] text-neutral-500">
              <Clock3 size={13} strokeWidth={1.6} />
              Horário de Brasília (UTC−3)
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------------------- Conteúdo principal -------------------- */}
      <div
        className={`min-h-screen p-0 transition-[padding] duration-200 lg:p-2 ${
          desktopHidden ? "lg:pl-2" : "lg:pl-[232px]"
        }`}
      >
        <div className="flex min-h-screen flex-col bg-white lg:min-h-[calc(100vh-16px)] lg:rounded-xl lg:border lg:border-neutral-200 lg:shadow-sm">
          <header className="flex h-[49px] shrink-0 items-center justify-between border-b border-neutral-200 px-4">
            <div className="flex min-w-0 items-center gap-2.5 text-[13px] text-neutral-500">
              <button
                type="button"
                onClick={toggleMenu}
                aria-label="Alternar menu lateral"
                className="rounded-md p-1 text-neutral-700 transition hover:bg-neutral-100"
              >
                <PanelLeft size={16} strokeWidth={1.6} />
              </button>
              <span className="h-4 w-px bg-neutral-200" aria-hidden />

              <nav aria-label="Trilha de navegação" className="min-w-0">
                <ol className="flex items-center gap-1.5">
                  {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;
                    return (
                      <li
                        key={`${crumb.label}-${index}`}
                        className={`flex min-w-0 items-center gap-1.5 ${
                          isLast ? "" : "hidden sm:flex"
                        }`}
                      >
                        {crumb.href && !isLast ? (
                          <Link
                            href={crumb.href}
                            className="transition hover:text-neutral-900"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span
                            aria-current={isLast ? "page" : undefined}
                            className={`truncate ${isLast ? "font-medium text-neutral-950" : ""}`}
                          >
                            {crumb.label}
                          </span>
                        )}
                        {!isLast && (
                          <ChevronRight
                            size={13}
                            strokeWidth={1.6}
                            className="shrink-0"
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Atualizar dados"
                className="rounded-md p-1.5 text-neutral-700 transition hover:bg-neutral-100"
              >
                <RefreshCw
                  size={15}
                  strokeWidth={1.6}
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>
            )}
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NavLink({
  href,
  icon,
  label,
  count,
  active = false,
  current = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  count?: number;
  /** Destaque visual (cartão branco com borda). */
  active?: boolean;
  /** Marca a rota como atual para tecnologias assistivas. */
  current?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`mt-0.5 flex items-center gap-2 rounded-lg border px-2 py-1.5 transition first:mt-0 ${
        active
          ? "border-neutral-200 bg-white font-medium shadow-sm"
          : "border-transparent text-neutral-800 hover:bg-neutral-200/50"
      }`}
    >
      <span className={active ? "text-[#155DFC]" : "text-neutral-600"}>
        {icon}
      </span>
      <span>{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-[12px] text-neutral-500">{count}</span>
      )}
    </Link>
  );
}
