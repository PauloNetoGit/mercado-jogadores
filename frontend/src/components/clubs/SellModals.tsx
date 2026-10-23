"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  HandCoins,
  History,
  Info,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Modal, ModalActions, btnPrimary, btnSecondary } from "@/src/components/Modal";
import { Avatar } from "@/src/components/players/Avatar";
import {
  clubsService,
  TETO_MULTA,
  type JogadorDoClube,
  type ResultadoVenda,
} from "@/src/services/clubs";
import { POSICOES } from "@/src/services/players";
import { formatMoney } from "@/src/utils/format";

/** Tempo mínimo do estado "Vendendo…", para a animação ser vista mesmo com a API rápida. */
const MIN_SELLING_MS = 1000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const TZ = "America/Sao_Paulo";

/** "2027-04-04T15:45:00-03:00" -> "04/04/2027, 15:45" (sempre em Brasília). */
function formatBrasilia(iso: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time}`;
}

function fineBadge(rate: number) {
  if (rate <= 0) return "border-green-200 bg-green-50 text-green-700";
  if (rate >= 20) return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

/* ----------------------------- Confirmar venda ----------------------------- */

export function SellModal({
  player,
  clubId,
  clubName,
  onCancel,
  onSold,
  onRefused,
}: {
  player: JogadorDoClube;
  clubId: number;
  clubName: string;
  onCancel: () => void;
  /** A API confirmou a venda; `wasStarter` diz se o jogador estava na escalação. */
  onSold: (result: ResultadoVenda, wasStarter: boolean) => void;
  /** A API recusou a venda: a tela do clube recarrega o elenco. */
  onRefused: () => void;
}) {
  const [starter, setStarter] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState("");
  const [networkError, setNetworkError] = useState(false);

  const contract = player.contract;
  const rate = contract?.penalty_rate ?? 0;

  // O jogador é titular? (GET /clubs/:id/lineup). Falha na consulta = não avisa.
  useEffect(() => {
    let cancelled = false;
    clubsService.isStarter(clubId, player.id).then((result) => {
      if (!cancelled) setStarter(result);
    });
    return () => {
      cancelled = true;
    };
  }, [clubId, player.id]);

  async function submit() {
    setSubmitting(true);
    setRefusal("");
    setNetworkError(false);
    try {
      // A espera mínima roda junto com a chamada: a venda leva no mínimo 1 segundo, sem somar tempos.
      const wasStarter = starter ?? (await clubsService.isStarter(clubId, player.id));
      const [result] = await Promise.all([clubsService.sell(player.id), wait(MIN_SELLING_MS)]);
      onSold(result, wasStarter);
    } catch (err) {
      // O fetch lança TypeError quando não consegue falar com o servidor (offline, API fora do ar).
      if (err instanceof TypeError) {
        setNetworkError(true);
      } else {
        const message = err instanceof Error ? err.message : "Não foi possível vender o jogador.";
        setRefusal(
          /livre/i.test(message) ? `${player.name} já está livre e não pode ser vendido.` : message,
        );
        onRefused();
      }
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Vender ${player.name}?`}
      description={`O jogador sai do elenco do ${clubName} e volta a ficar livre.`}
      onClose={onCancel}
      busy={submitting}
      width={460}
    >
      <div className="space-y-4">
        {networkError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          >
            <CircleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <div className="text-[13px] leading-5">
              <p className="font-medium text-red-800">Sem conexão</p>
              <p>A venda não foi confirmada. Verifique a conexão e tente de novo.</p>
            </div>
          </div>
        )}

        {refusal && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          >
            <CircleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <div className="text-[13px] leading-5">
              <p className="font-medium text-red-800">A venda foi recusada</p>
              <p>{refusal}</p>
            </div>
          </div>
        )}

        {starter && !refusal && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
          >
            <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <div className="text-[13px] leading-5">
              <p className="font-medium text-amber-900">{player.name} é titular</p>
              <p>
                Ao vender, ele sai da escalação, e o {clubName} só volta a jogar partidas depois de
                escalar de novo os 5 titulares.
              </p>
            </div>
          </div>
        )}

        {/* Jogador */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar id={player.id} name={player.name} size={32} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{player.name}</p>
              <p className="text-[11px] text-neutral-500">
                {player.position} · {POSICOES[player.position]} · {player.age} anos
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-neutral-500">Valor de mercado</p>
            <p className="text-[16px] font-semibold tabular-nums">
              {formatMoney(player.market_value)}
            </p>
          </div>
        </div>

        {/* Contrato */}
        <dl className="overflow-hidden rounded-xl border border-neutral-200 text-[13px]">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-neutral-600">Valor de compra</dt>
            <dd className="font-medium tabular-nums">
              {contract ? formatMoney(contract.purchase_value) : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-2.5">
            <dt className="text-neutral-600">Fim da fidelidade</dt>
            <dd className="font-medium tabular-nums">
              {contract ? formatBrasilia(contract.loyalty_until) : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-2.5">
            <dt className="text-neutral-600">Dias restantes</dt>
            <dd className="font-medium tabular-nums">
              {contract ? new Intl.NumberFormat("pt-BR").format(contract.remaining_days ?? 0) : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-2.5">
            <dt className="text-neutral-600">% de multa se vender agora</dt>
            <dd>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${fineBadge(rate)}`}
              >
                {rate === 0 && <Check size={11} strokeWidth={2.2} />}
                {rate}%
              </span>
            </dd>
          </div>
        </dl>

        <p className="flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[11px] leading-4 text-neutral-600">
          <Info size={14} strokeWidth={1.7} className="mt-px shrink-0" />A venda é pelo valor de
          mercado do momento. Multa (teto de {formatMoney(TETO_MULTA)}), lucro, comissão e crédito
          são calculados ao confirmar.
        </p>

        {submitting && (
          <p
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[11px] leading-4 text-neutral-600"
          >
            <Info size={14} strokeWidth={1.7} className="mt-px shrink-0" />
            Enviando a venda. Os botões ficam desabilitados até a resposta.
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-neutral-200" />
      <ModalActions>
        <button type="button" onClick={onCancel} disabled={submitting} className={btnSecondary}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          aria-busy={submitting}
          className={`${btnPrimary} min-w-[150px] justify-center transition-opacity ${submitting ? "cursor-wait opacity-70" : ""}`}
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : networkError ? (
            <RefreshCw size={14} strokeWidth={1.8} />
          ) : (
            <HandCoins size={14} strokeWidth={1.8} />
          )}
          {submitting ? "Vendendo…" : networkError ? "Tentar de novo" : "Confirmar venda"}
        </button>
      </ModalActions>
    </Modal>
  );
}

/* ------------------------------ Venda concluída ----------------------------- */

export interface SaleDoneData {
  playerName: string;
  clubName: string;
  wasStarter: boolean;
  purchaseValue: number;
  saleValue: number;
  remainingDays: number;
  penaltyRate: number;
  penalty: number;
  profit: number;
  commission: number;
  credit: number;
  contractStatus: string;
  newCash: number;
}

export function saleDoneFrom(
  result: ResultadoVenda,
  player: JogadorDoClube,
  clubName: string,
  wasStarter: boolean,
): SaleDoneData {
  const status = (result as ResultadoVenda & { contract_status?: string }).contract_status;
  return {
    playerName: player.name,
    clubName,
    wasStarter,
    purchaseValue: result.purchase_value,
    saleValue: result.value,
    remainingDays: result.remaining_days,
    penaltyRate: result.penalty_rate,
    penalty: result.penalty,
    profit: result.profit ?? result.value - result.purchase_value,
    commission: result.fee,
    credit: result.cash_change,
    // A API devolve RESCINDIDO (houve multa) ou ENCERRADO (fidelidade cumprida).
    contractStatus: status ?? (result.penalty > 0 ? "RESCINDIDO" : "ENCERRADO"),
    newCash: result.club_cash,
  };
}

function signed(value: number) {
  if (value > 0) return `+${formatMoney(value)}`;
  if (value < 0) return `−${formatMoney(Math.abs(value))}`;
  return formatMoney(0);
}

export function SaleDoneModal({
  data,
  onClose,
  onViewHistory,
}: {
  data: SaleDoneData;
  onClose: () => void;
  onViewHistory?: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const penaltyApplied = data.penaltyRate > 0;
  const rescinded = data.contractStatus.toUpperCase() === "RESCINDIDO";
  const profitClass =
    data.profit > 0 ? "text-green-700" : data.profit < 0 ? "text-red-600" : "text-neutral-950";

  const intro = `${data.playerName} voltou a ficar livre${data.wasStarter ? " e saiu da escalação" : ""}.`;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-done-title"
        className="my-auto w-full max-w-[500px] rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <CircleCheck size={20} strokeWidth={1.8} />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-neutral-600 transition hover:bg-neutral-100"
          >
            <X size={16} />
          </button>
        </div>

        <h2 id="sale-done-title" className="mt-4 text-[20px] font-semibold tracking-tight">
          Venda concluída
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-neutral-500">
          {intro}
          {!penaltyApplied && " A fidelidade já tinha terminado, então não houve multa."}
        </p>

        <dl className="mt-5 overflow-hidden rounded-xl border border-neutral-200 text-[13px]">
          <Line label="Valor de compra" value={formatMoney(data.purchaseValue)} />
          <Line
            label="Valor de venda"
            hint="Valor de mercado no momento da venda"
            value={formatMoney(data.saleValue)}
          />
          <Line
            label="Dias restantes"
            value={new Intl.NumberFormat("pt-BR").format(data.remainingDays)}
          />
          <Line
            label="Multa"
            hint={
              penaltyApplied
                ? `${data.penaltyRate}% do valor de venda, com teto de ${formatMoney(TETO_MULTA)}`
                : "Fidelidade cumprida: sem multa"
            }
            value={formatMoney(data.penalty)}
          />
          <Line label="Lucro" value={signed(data.profit)} valueClass={profitClass} />
          <Line
            label="Comissão"
            hint={
              data.profit > 0
                ? "10% do lucro até 10,00 + 20% do que passar"
                : "Sem lucro: sem comissão"
            }
            value={formatMoney(data.commission)}
          />
          <Line
            label="Crédito no caixa"
            hint="Valor de venda – multa – comissão"
            value={signed(data.credit)}
            strong
          />
          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-3">
            <dt className="text-neutral-600">Contrato</dt>
            <dd>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase ${
                  rescinded
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-neutral-200 bg-neutral-50 text-neutral-700"
                }`}
              >
                <span aria-hidden className="text-[8px]">
                  ●
                </span>
                {data.contractStatus}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 bg-neutral-50 px-4 py-3">
            <dt className="font-semibold">Novo caixa do {data.clubName}</dt>
            <dd className="text-[16px] font-semibold tabular-nums">{formatMoney(data.newCash)}</dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-neutral-200" />
        <div className="mt-4 flex justify-end gap-2">
          {onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50"
            >
              <History size={14} strokeWidth={1.7} />
              Ver histórico
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

function Line({
  label,
  hint,
  value,
  valueClass = "",
  strong = false,
}: {
  label: string;
  hint?: string;
  value: string;
  valueClass?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 not-first:border-t not-first:border-neutral-200 ${
        strong ? "bg-neutral-50" : ""
      }`}
    >
      <div>
        <dt className={strong ? "font-semibold" : "text-neutral-600"}>{label}</dt>
        {hint && <p className="text-[11px] text-neutral-500">{hint}</p>}
      </div>
      <dd
        className={`tabular-nums ${strong ? "text-[16px] font-semibold" : "font-medium"} ${valueClass}`}
      >
        {value}
      </dd>
    </div>
  );
}
