"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/src/services/api";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Users,
  User,
  Shield,
  Swords,
  Trophy,
  ArrowRight,
  Clock,
  ChevronRight,
  CheckCircle2,
  ShoppingCart,
  Tag,
  History,
} from "lucide-react";

const modules = [
  {
    n: "01",
    title: "Jogadores",
    icon: Users,
    text: "Nascem livres e Apto; o valor de mercado vem da condição, agilidade e idade.",
  },
  {
    n: "02",
    title: "Clubes",
    icon: Shield,
    text: "Começam com 300,00 em caixa e sem jogadores.",
  },
  {
    n: "03",
    title: "Compra",
    icon: ShoppingCart,
    text: "Valor + taxa, até 50% do caixa, com contrato de fidelidade.",
  },
  {
    n: "04",
    title: "Venda",
    icon: Tag,
    text: "Multa antes do fim da fidelidade e comissão sobre o lucro.",
  },
  {
    n: "05",
    title: "Histórico",
    icon: History,
    text: "Toda compra e venda fica registrada, com totais e CSV.",
  },
  {
    n: "06",
    title: "Liga",
    icon: Trophy,
    text: "Escale 5 titulares e jogue partidas que entram na classificação.",
  },
];

type Player = {
  id: number;
  name: string;
  club_id: number | null;
};

type PlayersResponse = {
  data: Player[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
};

type Club = {
  id: number;
  name: string;
};

type Match = {
  id: number;
};

type Standing = {
  position: number;
  club_name: string;
  points: number;
};

type DashboardData = {
  players: number;
  freePlayers: number;
  clubs: number;
  matches: number;
  leader: { name: string; points: number } | null;
};

export default function Home() {
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardData>({
    players: 0,
    freePlayers: 0,
    clubs: 0,
    matches: 0,
    leader: null,
  });

  const [dashboardError, setDashboardError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [
          playersResponse,
          freeResponse,
          clubsResponse,
          matchesResponse,
          standings,
        ] = await Promise.all([
          api.get<PlayersResponse>("/players?page=1&limit=1"),
          api.get<PlayersResponse>("/players?page=1&limit=1&free=true"),
          api.get<Club[]>("/clubs"),
          api.get<Match[]>("/matches"),
          // A classificação só enfeita o selo: se falhar, o resto continua.
          api.get<Standing[]>("/standings").catch(() => [] as Standing[]),
        ]);

        if (!active) return;

        setDashboard({
          players: playersResponse.meta.total,
          freePlayers: freeResponse.meta.total,
          clubs: clubsResponse.length,
          matches: matchesResponse.length,
          // A API já devolve a tabela ordenada (pontos, saldo, gols pró, nome).
          leader:
            matchesResponse.length > 0 && standings.length > 0
              ? { name: standings[0].club_name, points: standings[0].points }
              : null,
        });

        setDashboardError(false);
      } catch (error) {
        console.error("Erro ao carregar os dados iniciais:", error);

        if (active) {
          setDashboardError(true);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  // Atalho: redireciona ao pressionar "Enter"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        router.push("/jogadores");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-white px-10 py-6 font-sans text-gray-900 antialiased">
      {/* CAMPO: container que cresce conforme o conteúdo */}
      <div className="relative w-full max-w-[1400px]">
        {/* Linhas do campo (SVG estica junto com o container) */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl border border-gray-200">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1000 600"
            preserveAspectRatio="none"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Linha central e círculo do meio */}
            <line
              x1="500"
              y1="0"
              x2="500"
              y2="600"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="500"
              cy="300"
              r="95"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="500" cy="300" r="2" fill="#d1d5db" stroke="none" />

            {/* Grande área esquerda */}
            <rect
              x="0"
              y="150"
              width="140"
              height="300"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x="0"
              y="228"
              width="50"
              height="144"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="100" cy="300" r="2" fill="#d1d5db" stroke="none" />
            <path
              d="M 140 250 A 70 70 0 0 1 140 350"
              vectorEffect="non-scaling-stroke"
            />

            {/* Grande área direita */}
            <rect
              x="860"
              y="150"
              width="140"
              height="300"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x="950"
              y="228"
              width="50"
              height="144"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="900" cy="300" r="2" fill="#d1d5db" stroke="none" />
            <path
              d="M 860 250 A 70 70 0 0 0 860 350"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* Traves (saem para fora do campo) */}
        <div className="pointer-events-none absolute -left-[14px] top-1/2 z-0 h-[11%] w-[14px] -translate-y-1/2 rounded-l-md border-y border-l border-gray-200" />
        <div className="pointer-events-none absolute -right-[14px] top-1/2 z-0 h-[11%] w-[14px] -translate-y-1/2 rounded-r-md border-y border-r border-gray-200" />

        {/* CONTEÚDO */}
        <div className="relative z-10 flex flex-col items-center px-4 pb-5 pt-12 ">
          {/* HERO (fundo branco cobre o meio do campo) */}
          <div className="relative z-10 flex w-[70%] max-w-4xl flex-col items-center bg-white px-6 py-4 text-center">
            {/* Logo e Nome "Passe" */}
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl">
                <Image
                  src="/Marca.svg"
                  alt="Logo Passe"
                  width={48}
                  height={48}
                  className="object-cover"
                  priority
                />
              </div>
              <span className="text-[32px] font-semibold leading-10 tracking-[-0.03em] text-gray-900">
                Passe
              </span>
            </div>

            {/* Badge Liga Fictícia */}
            <div className="mt-6 flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50/80 px-3.5 py-1 text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <strong className="font-medium text-gray-900">
                Liga Fictícia 2026
              </strong>
              <span className="text-[#726871]">·</span>
              <span className="text-[#726871]">
                {dashboardError
                  ? "dados indisponíveis"
                  : dashboard.matches === 0
                    ? "nenhuma partida ainda"
                    : dashboard.leader
                      ? `líder: ${dashboard.leader.name}, ${dashboard.leader.points} ${
                          dashboard.leader.points === 1 ? "ponto" : "pontos"
                        }`
                      : `${dashboard.matches} ${
                        dashboard.matches === 1
                          ? "partida registrada"
                          : "partidas registradas"
                      }`}
              </span>
            </div>

            {/* Título Principal */}
            <h1 className="mt-5 text-[40px] font-semibold leading-[48px] tracking-tight text-gray-900">
              Gestão da liga, do mercado à classificação
            </h1>

            {/* Subtítulo */}
            <p className="mt-3 max-w-[630px] text-base leading-6 text-[#686872]">
              Cadastre jogadores, monte os clubes e negocie com contrato de
              fidelidade. Depois, escale os titulares e jogue partidas com
              placar calculado pelos atributos.
            </p>

            {/* Botão de Iniciar com atalho Enter */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/jogadores"
                className="inline-flex h-10 min-w-[200px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
              >
                Iniciar
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-sm text-gray-400">
                ou tecle{" "}
                <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                  Enter
                </kbd>
              </span>
            </div>

            {/* Indicadores */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gray-400" />
                <span>
                  <strong className="font-medium text-gray-800">{dashboard.players}</strong>{" "}
                  jogadores
                </span>
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span>
                  <strong className="font-medium text-gray-800">{dashboard.freePlayers}</strong>{" "}
                  livres
                </span>
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                <span>
                  <strong className="font-medium text-gray-800">{dashboard.clubs}</strong>{" "}
                  clubes
                </span>
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5">
                <Swords className="h-3.5 w-3.5 text-gray-400" />
                <span>
                  <strong className="font-medium text-gray-800">{dashboard.matches}</strong>{" "}
                  partidas
                </span>
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" />
                <span>Não precisa de login</span>
              </div>
            </div>
          </div>

          {/* FLUXO DOS MÓDULOS DE 01 A 06 */}
          <div className="mt-8 grid w-full grid-cols-3 gap-5 lg:grid-cols-6">
            {modules.map(({ n, title, icon: Icon, text }, i) => (
              <div
                key={n}
                className="group relative flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-mono text-xs text-gray-400">{n}</span>
                </div>

                <h3 className="mt-5 text-base font-medium leading-6">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-[18px] text-gray-500">
                  {text}
                </p>

                {i < modules.length - 1 && (
                  <ChevronRight className="absolute -right-[18px] top-1/2 hidden h-4 w-4 -translate-y-1/2 text-gray-400 lg:block" />
                )}
              </div>
            ))}
          </div>

          {/* Rodapé dentro do campo */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs leading-4 text-[#686872]">
            <Clock className="h-3.5 w-3.5" />
            <span>Liga Fictícia 2026 · Horário de Brasília (UTC-3)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
