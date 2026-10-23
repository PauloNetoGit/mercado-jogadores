"use client";

import { useState } from "react";
import { Calendar, CircleAlert, Clock, Info, Loader2, RefreshCw, ShoppingCart } from "lucide-react";
import { Modal, ModalActions, btnPrimary, btnSecondary, inputClass } from "@/src/components/Modal";
import { Avatar } from "@/src/components/players/Avatar";
import type { PurchaseDoneData } from "@/src/components/players/PurchaseDoneModal";
import { POSICOES, playersService } from "@/src/services/players";
import {
  defaultLoyalty,
  formatBrasilia,
  maskDate,
  maskTime,
  parseLoyalty,
  type LoyaltyFieldErrors,
} from "@/src/utils/loyalty";
import { formatMoney } from "@/src/utils/format";
import type { Clube, Jogador } from "@/src/types";

const MIN_BUYING_MS = 1000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const invalidClass = "!border-red-500 focus:!border-red-500 focus:!ring-red-500/15";

export function BuyModal({
  player,
  clubs,
  onClose,
  onBought,
}: {
  player: Jogador;
  clubs: Clube[];
  onClose: () => void;
  /** A API confirmou a compra: devolve os dados para o diálogo "Compra concluída". */
  onBought: (data: PurchaseDoneData) => void;
}) {
  const [clubId, setClubId] = useState("");
  const [initial] = useState(() => defaultLoyalty());
  const [dateText, setDateText] = useState(initial.date);
  const [timeText, setTimeText] = useState(initial.time);
  const [clubError, setClubError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoyaltyFieldErrors>({});
  const [failure, setFailure] = useState<{
    kind: "refused" | "network";
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const club = clubs.find((item) => String(item.id) === clubId);

  async function submit() {
    setFailure(null);
    let valid = true;

    if (!club) {
      setClubError("Escolha o clube comprador.");
      valid = false;
    } else {
      setClubError("");
    }

    const parsed = parseLoyalty(dateText, timeText);
    if (parsed.errors) {
      setFieldErrors(parsed.errors);
      valid = false;
    } else {
      setFieldErrors({});
    }
    if (!valid || !club || !parsed.value) return;

    setSubmitting(true);
    let result;
    try {
      // O horário é de Brasília (UTC−3), no formato que a API exige.
      [result] = await Promise.all([
        playersService.buy(player.id, {
          club_id: club.id,
          loyalty_until: parsed.value,
        }),
        wait(MIN_BUYING_MS),
      ]);
    } catch (err) {
      console.warn("Falha na chamada de compra (POST /players/:id/buy):", err);
      // O fetch lança TypeError quando não consegue falar com o servidor.
      setFailure(
        err instanceof TypeError
          ? {
              kind: "network",
              message: "A compra não foi confirmada. Verifique a conexão e tente de novo.",
            }
          : {
              kind: "refused",
              message: err instanceof Error ? err.message : "Não foi possível comprar o jogador.",
            },
      );
      setSubmitting(false);
      return;
    }

    // A compra já foi gravada pela API. Se a tela falhar ao se atualizar, não dizemos que a compra falhou.
    try {
      onBought({
        playerName: result.player_name,
        clubId: club.id,
        clubName: club.name,
        value: result.value,
        fee: result.fee,
        loyaltyLabel: formatBrasilia(parsed.value),
        contractStatus: "ATIVO",
        newCash: result.club_cash,
      });
    } catch (err) {
      console.error("Compra concluída, mas a tela falhou ao atualizar:", err);
      setFailure({
        kind: "refused",
        message:
          "A compra foi concluída, mas a tela falhou ao atualizar. Feche este aviso e recarregue a página.",
      });
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Comprar jogador"
      description="Escolha o clube comprador e até quando vai a fidelidade do contrato."
      onClose={onClose}
      busy={submitting}
      width={460}
    >
      <div className="space-y-3.5">
        {failure && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700"
          >
            <CircleAlert size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {failure.kind === "network" ? "Sem conexão" : "Compra recusada"}
              </p>
              <p>{failure.message}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3">
          <Avatar id={player.id} name={player.name} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{player.name}</p>
            <p className="text-[11px] text-neutral-500">
              {player.position} · {POSICOES[player.position]} · {player.age} anos
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] text-neutral-500">Valor de mercado</p>
            <p className="text-[16px] font-semibold tabular-nums">
              {formatMoney(player.market_value)}
            </p>
          </div>
        </div>

        <label className="block text-[12px] font-medium">
          Clube comprador
          <select
            value={clubId}
            onChange={(event) => {
              setClubId(event.target.value);
              setClubError("");
              setFailure(null);
            }}
            className={`${inputClass} mt-1 ${clubError ? invalidClass : ""}`}
          >
            <option value="">Selecione um clube</option>
            {clubs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.acronym}) · caixa {formatMoney(item.cash)}
              </option>
            ))}
          </select>
          {clubError ? (
            <span className="mt-1 block text-[11px] font-normal text-red-600">{clubError}</span>
          ) : (
            club && (
              <span className="mt-1 block text-[11px] font-normal text-neutral-500">
                Caixa atual: {formatMoney(club.cash)}. O custo total (valor + taxa) pode ir até 50%
                do caixa.
              </span>
            )
          )}
        </label>

        <div>
          <p className="text-[12px] font-medium">Fim da fidelidade</p>
          <div className="mt-1 grid grid-cols-[1fr_96px] gap-2">
            <label className="relative block">
              <Calendar
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              />
              <input
                inputMode="numeric"
                value={dateText}
                onChange={(event) => setDateText(maskDate(event.target.value))}
                placeholder="dd/mm/aaaa"
                aria-label="Data do fim da fidelidade"
                className={`${inputClass} pl-8 ${fieldErrors.date ? invalidClass : ""}`}
              />
            </label>
            <label className="relative block">
              <Clock
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              />
              <input
                inputMode="numeric"
                value={timeText}
                onChange={(event) => setTimeText(maskTime(event.target.value))}
                placeholder="hh:mm"
                aria-label="Hora do fim da fidelidade"
                className={`${inputClass} pl-8 ${fieldErrors.time ? invalidClass : ""}`}
              />
            </label>
          </div>
          {fieldErrors.date || fieldErrors.time ? (
            <p className="mt-1 text-[11px] text-red-600">{fieldErrors.date ?? fieldErrors.time}</p>
          ) : (
            <p className="mt-1 text-[11px] text-neutral-500">
              Depois do momento da compra e até 1.095 dias. Horário de Brasília; enviado com o fuso
              (-03:00).
            </p>
          )}
        </div>

        <p className="flex gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11.5px] leading-[17px] text-neutral-600">
          <Info size={13} className="mt-0.5 shrink-0" />A taxa é de 5% do valor de mercado, só
          quando ele passa de 30,00. Taxa, custo e novo caixa são calculados ao confirmar.
        </p>
      </div>

      <ModalActions>
        <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
          Cancelar
        </button>
        <button type="button" onClick={submit} disabled={submitting} className={btnPrimary}>
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : failure?.kind === "network" ? (
            <RefreshCw size={14} />
          ) : (
            <ShoppingCart size={14} />
          )}
          {submitting
            ? "Comprando…"
            : failure?.kind === "network"
              ? "Tentar de novo"
              : "Confirmar compra"}
        </button>
      </ModalActions>
    </Modal>
  );
}
