import { Avatar } from "@/src/components/players/Avatar";
import { CONDICOES, POSICOES } from "@/src/services/players";
import type { Condicao, Jogador } from "@/src/types";

export function ConditionBadge({ condition }: { condition: Condicao }) {
  const status = CONDICOES[condition];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: status.color, background: status.bg, border: `1px solid ${status.color}25` }}
    >
      <span aria-hidden className="text-[8px]">
        ●
      </span>
      {status.label}
    </span>
  );
}

/** Cartão com o jogador, usado nos diálogos de condição e de exclusão. */
export function PlayerSummary({
  player,
  badge,
  clubName,
}: {
  player: Jogador;
  badge: React.ReactNode;
  /** Quando informado, o clube aparece depois da idade. */
  clubName?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3">
      <Avatar id={player.id} name={player.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{player.name}</p>
        <p className="text-[12px] text-neutral-500">
          {player.position} · {POSICOES[player.position]} · {player.age} anos
          {clubName ? ` · ${clubName}` : ""}
        </p>
      </div>
      {badge}
    </div>
  );
}
