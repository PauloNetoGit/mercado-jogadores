"use client";

import { ArrowLeft, ArrowRight, HeartPulse } from "lucide-react";
import { initialsOf } from "@/src/components/players/Avatar";
import type { AtributoDuelo, PartidaDetalhe } from "@/src/services/matches";
import type { Condicao, Posicao } from "@/src/types";

/** Bola de futebol em traço; herda a cor do texto (currentColor). */
export function SoccerBall({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="12,7.4 16.1,10.4 14.5,15.1 9.5,15.1 7.9,10.4" fill="currentColor" />
      <path d="M12 7.4V2.2M16.1 10.4l4.9-1.6M14.5 15.1l3 4.1M9.5 15.1l-3 4.1M7.9 10.4 3 8.8" />
    </svg>
  );
}

export const ATTRIBUTE_LABEL: Record<AtributoDuelo, string> = {
  shooting: "Finalização",
  passing: "Passe",
  dribbling: "Drible",
  defending: "Defesa",
};

const ATTRIBUTE_SHORT: Record<AtributoDuelo, string> = {
  shooting: "Fin",
  passing: "Pas",
  dribbling: "Dri",
  defending: "Def",
};

const POSITION_ORDER: Record<Posicao, number> = { GOL: 0, ZAG: 1, LAT: 2, MEI: 3, ATA: 4 };

interface FieldPlayer {
  id: number;
  name: string;
  position: Posicao;
  condition: Condicao;
  attack?: { attribute: AtributoDuelo; value: number; scored: boolean };
  defense?: number;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Os titulares de cada clube e os valores usados nos duelos. Todo titular aparece em algum duelo
 * (o goleiro e os 2 primeiros de linha defendem; os 3 últimos de linha atacam), então a lista sai dos duelos.
 */
function collectPlayers(match: PartidaDetalhe) {
  const byClub = new Map<number, Map<number, FieldPlayer>>([
    [match.home.club_id, new Map()],
    [match.away.club_id, new Map()],
  ]);

  const entry = (clubId: number, source: PartidaDetalhe["duels"][number]["attacker"]) => {
    const players = byClub.get(clubId)!;
    let player = players.get(source.player_id);
    if (!player) {
      player = {
        id: source.player_id,
        name: source.player_name,
        position: source.position,
        condition: source.condition,
      };
      players.set(player.id, player);
    }
    return player;
  };

  for (const duel of match.duels) {
    const attackingId = duel.attacking_club_id;
    const defendingId = attackingId === match.home.club_id ? match.away.club_id : match.home.club_id;
    entry(attackingId, duel.attacker).attack = {
      attribute: duel.attacker.attribute,
      value: duel.attacker.value,
      scored: duel.goal,
    };
    entry(defendingId, duel.defender).defense = duel.defender.value;
  }

  const sorted = (clubId: number) =>
    [...byClub.get(clubId)!.values()].sort(
      (a, b) =>
        POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
        normalized(a.name).localeCompare(normalized(b.name)) ||
        a.id - b.id,
    );
  return { home: sorted(match.home.club_id), away: sorted(match.away.club_id) };
}

interface Placed {
  player: FieldPlayer;
  x: number;
  y: number;
}

/** Linha de defesa à esquerda do meio-campo: "2-1-1" = 2 na defesa, 1 no meio, 1 no ataque. */
function place(players: FieldPlayer[], formation: string, mirror: boolean): Placed[] {
  const flip = (x: number) => (mirror ? 100 - x : x);
  const goalkeeper = players.find((player) => player.position === "GOL");
  const field = players.filter((player) => player.position !== "GOL");

  const sizes = formation.split("-").map(Number);
  const lines =
    sizes.every((size) => Number.isInteger(size) && size > 0) && sizes.reduce((a, b) => a + b, 0) === field.length
      ? sizes
      : [field.length];

  const placed: Placed[] = [];
  if (goalkeeper) placed.push({ player: goalkeeper, x: flip(6.5), y: 50 });

  let cursor = 0;
  lines.forEach((size, lineIndex) => {
    const x = lines.length === 1 ? 29 : 18 + (22 * lineIndex) / (lines.length - 1);
    const ys =
      size === 1
        ? [50]
        : size === 2
          ? [32, 68]
          : size === 3
            ? [22, 50, 78]
            : Array.from({ length: size }, (_, index) => 15 + (70 * index) / (size - 1));
    field.slice(cursor, cursor + size).forEach((player, index) => {
      placed.push({ player, x: flip(x), y: ys[index] });
    });
    cursor += size;
  });
  return placed;
}

function subtitle(player: FieldPlayer) {
  const parts: string[] = [player.position];
  if (player.attack) parts.push(`${ATTRIBUTE_SHORT[player.attack.attribute]} ${player.attack.value}`);
  if (player.defense !== undefined) parts.push(`Def ${player.defense}`);
  return parts.join(" · ");
}

export function MatchField({ match }: { match: PartidaDetalhe }) {
  const { home, away } = collectPlayers(match);
  const homePlaced = place(home, match.home.formation, false);
  const awayPlaced = place(away, match.away.formation, true);

  return (
    <div className="overflow-x-auto p-4 sm:p-6">
      <div
        className="relative aspect-[2.43/1] min-w-[820px] overflow-hidden rounded-2xl"
        style={{
          background: "repeating-linear-gradient(90deg, #0d5a2c 0 7.1429%, #10652f 7.1429% 14.2858%)",
        }}
      >
        {/* Marcações do campo */}
        <div aria-hidden className="pointer-events-none absolute inset-x-[2.2%] inset-y-[5%] border border-white/35" />
        <div aria-hidden className="pointer-events-none absolute inset-y-[5%] left-1/2 border-l border-white/35" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35"
        />
        <div aria-hidden className="pointer-events-none absolute left-[2.2%] top-[23.5%] h-[53%] w-[9%] border border-l-0 border-white/35" />
        <div aria-hidden className="pointer-events-none absolute left-[2.2%] top-[37.5%] h-[25%] w-[3.2%] border border-l-0 border-white/35" />
        <div aria-hidden className="pointer-events-none absolute right-[2.2%] top-[23.5%] h-[53%] w-[9%] border border-r-0 border-white/35" />
        <div aria-hidden className="pointer-events-none absolute right-[2.2%] top-[37.5%] h-[25%] w-[3.2%] border border-r-0 border-white/35" />

        {/* Identificação dos times */}
        <TeamChip name={match.home.club_name} formation={match.home.formation} side="home" />
        <TeamChip name={match.away.club_name} formation={match.away.formation} side="away" />

        {homePlaced.map((item) => (
          <Token key={`h-${item.player.id}`} item={item} side="home" />
        ))}
        {awayPlaced.map((item) => (
          <Token key={`a-${item.player.id}`} item={item} side="away" />
        ))}
      </div>
    </div>
  );
}

function TeamChip({ name, formation, side }: { name: string; formation: string; side: "home" | "away" }) {
  const home = side === "home";
  return (
    <div
      className={`absolute top-[4%] flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[12px] text-white ${
        home ? "left-[3.4%]" : "right-[3.4%]"
      }`}
    >
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full ${home ? "bg-[#155DFC]" : "bg-white"}`}
      />
      <span className="font-semibold">{name}</span>
      <span>{formation}</span>
      <span aria-hidden className="h-3.5 w-px bg-white/30" />
      <span className="flex items-center gap-1 text-white/85">
        ataca
        {home ? <ArrowRight size={12} strokeWidth={2} /> : <ArrowLeft size={12} strokeWidth={2} />}
      </span>
    </div>
  );
}

function Token({ item, side }: { item: Placed; side: "home" | "away" }) {
  const { player } = item;
  const home = side === "home";
  const weak = player.condition === "MAL_CONDICIONADO";
  const scored = player.attack?.scored === true;

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: `${item.x}%`, top: `${item.y}%`, transform: "translate(-50%, -22px)" }}
    >
      <span
        className={`relative flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-semibold ${
          home
            ? "bg-[#155DFC] text-white ring-2 ring-white/70"
            : "bg-white text-neutral-900 ring-2 ring-black/10"
        }`}
      >
        {initialsOf(player.name)}
        {weak && (
          <span
            title="Mal condicionado: joga com 15% a menos"
            className="absolute -left-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white bg-[#C2570C] text-white"
          >
            <HeartPulse size={10} strokeWidth={2.2} />
          </span>
        )}
        {scored && (
          <span
            title="Gol no duelo"
            className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-900"
          >
            <SoccerBall size={12} />
          </span>
        )}
      </span>
      <span className="mt-1.5 whitespace-nowrap rounded-md bg-black/45 px-2 py-0.5 text-[12px] font-semibold text-white">
        {player.name}
      </span>
      <span className="mt-0.5 whitespace-nowrap rounded bg-black/30 px-1.5 text-[11px] leading-[18px] text-white/80">
        {subtitle(player)}
      </span>
    </div>
  );
}

/** Legenda do cabeçalho do card "Em campo". */
export function FieldLegend() {
  return (
    <div className="flex items-center gap-4 text-[12px] text-neutral-600">
      <span className="flex items-center gap-1.5">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#C2570C] text-white">
          <HeartPulse size={10} strokeWidth={2.2} />
        </span>
        Mal condicionado
      </span>
      <span className="flex items-center gap-1.5">
        <SoccerBall size={16} className="text-neutral-900" />
        Gol no duelo
      </span>
    </div>
  );
}
