"use client";

import { useEffect } from "react";
import { CircleCheck, Eye, X } from "lucide-react";
import { formatMoney } from "@/src/utils/format";

export type PlayerCreatedData = {
  name: string;
  /** Rótulo da condição, ex.: "Apto". */
  conditionLabel: string;
  /** Rótulo da posição, ex.: "Meio-campo". */
  positionLabel: string;
  /** Nome do clube; se vazio/nulo o jogador entrou livre. */
  clubName?: string | null;
  baseValue: number;
  marketValue: number;
  overall: number;
};

export function PlayerCreatedModal({
  player,
  onClose,
  onViewDetails,
}: {
  player: PlayerCreatedData;
  onClose: () => void;
  onViewDetails?: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-created-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[520px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
            <CircleCheck size={18} strokeWidth={1.8} />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100"
          >
            <X size={16} />
          </button>
        </div>

        <h2 id="player-created-title" className="mt-4 text-[18px] font-semibold tracking-tight">
          Jogador cadastrado
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-neutral-500">
          {player.name} entrou {player.clubName ? `no ${player.clubName}` : "livre"} e{" "}
          {player.conditionLabel}. Valores em moedas, calculados pela API ao salvar.
        </p>

        <dl className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
          <div className="flex items-center justify-between bg-neutral-50 px-4 py-3">
            <div>
              <dt className="text-[13px] font-semibold">Valor base</dt>
              <p className="text-[12px] text-neutral-500">Calculado no cadastro; não muda depois</p>
            </div>
            <dd className="text-[18px] font-semibold tabular-nums">{formatMoney(player.baseValue)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3">
            <div>
              <dt className="text-[13px] text-neutral-600">Valor de mercado</dt>
              <p className="text-[12px] text-neutral-500">Com condição, agilidade e idade</p>
            </div>
            <dd className="text-[14px] font-medium tabular-nums">{formatMoney(player.marketValue)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3">
            <div>
              <dt className="text-[13px] text-neutral-600">Overall</dt>
              <p className="text-[12px] text-neutral-500">
                Pelos pesos da posição {player.positionLabel}
              </p>
            </div>
            <dd className="text-[14px] font-medium tabular-nums">{player.overall}</dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end gap-2">
          {onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50"
            >
              <Eye size={14} strokeWidth={1.7} />
              Ver detalhes
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="h-9 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Como usar na tela/formulário de cadastro de jogador:
 *
 * const [created, setCreated] = useState<PlayerCreatedData | null>(null);
 *
 * async function handleSubmit(values) {
 *   const saved = await playersService.create(values); // resposta da API
 *   setCreated({
 *     name: saved.name,
 *     conditionLabel: CONDITIONS[saved.condition]?.label ?? saved.condition,
 *     positionLabel: POSITION_LABELS[saved.position],
 *     clubName: saved.club?.name ?? null,
 *     baseValue: saved.base_value,
 *     marketValue: saved.market_value,
 *     overall: saved.overall,
 *   });
 *   reloadList(); // atualiza a tabela por trás do pop-up
 * }
 *
 * // no JSX:
 * {created && (
 *   <PlayerCreatedModal
 *     player={created}
 *     onClose={() => setCreated(null)}
 *     onViewDetails={() => router.push(`/jogadores/${savedId}`)}
 *   />
 * )}
 * ------------------------------------------------------------------------- */
