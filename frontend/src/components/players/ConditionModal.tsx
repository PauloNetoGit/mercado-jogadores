"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Loader2, Lock, TriangleAlert } from "lucide-react";
import { clubsService } from "@/src/services/clubs";
import { Modal, ModalActions, btnPrimary, btnSecondary } from "@/src/components/Modal";
import { ConditionBadge, PlayerSummary } from "@/src/components/players/PlayerBits";
import { CONDICOES, playersService } from "@/src/services/players";
import type { Condicao, Jogador } from "@/src/types";

// Regras RN02 e RN03 do backend (player-calculations.ts).
const DESCRIPTIONS: Record<Condicao, string> = {
  APTO: "Sem desconto por condição.",
  MAL_CONDICIONADO:
    "Desconto de 15%. Agilidade de 80 a 100 corta pela metade; de 1 a 30 soma 10 pontos.",
  DOENTE: "Desconto de 30%, com o mesmo ajuste de agilidade.",
};

export function ConditionModal({
  player,
  clubName,
  onClose,
  onChanged,
}: {
  player: Jogador;
  /** Nome do clube do jogador; sem ele, o jogador aparece como livre. */
  clubName?: string;
  onClose: () => void;
  /** marketValue vem de uma nova consulta; pode faltar se ela falhar. */
  onChanged: (condition: Condicao, marketValue?: number) => void;
}) {
  const [value, setValue] = useState<Condicao>(player.condition);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [starter, setStarter] = useState(false);

  useEffect(() => {
    if (player.club_id === null) return;
    let cancelled = false;
    clubsService
      .isStarter(player.club_id, player.id)
      .then((result) => !cancelled && setStarter(result))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [player.club_id, player.id]);

  async function submit() {
    if (value === player.condition) return onClose();
    setSubmitting(true);
    setError("");
    try {
      await playersService.setCondition(player.id, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a condição.");
      setSubmitting(false);
      return;
    }
    // A alteração já foi salva; o novo valor de mercado é só para o aviso.
    const updated = await playersService.get(player.id).catch(() => null);
    onChanged(value, updated?.market_value);
  }

  return (
    <Modal
      title="Alterar condição física"
      description="A condição muda o desconto do valor de mercado, recalculado ao salvar."
      onClose={onClose}
      busy={submitting}
      width={480}
    >
      <PlayerSummary
        player={player}
        clubName={clubName}
        badge={<ConditionBadge condition={player.condition} />}
      />

      <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Condição física">
        {(Object.keys(CONDICOES) as Condicao[]).map((key) => {
          // Regra do backend: Doente não passa direto para Apto.
          const blocked = player.condition === "DOENTE" && key === "APTO";
          const selected = value === key;
          return (
            <label
              key={key}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                blocked ? "cursor-not-allowed text-neutral-400" : "cursor-pointer"
              } ${selected ? "border-[#155DFC] bg-[#155DFC]/5" : "border-neutral-200"}`}
            >
              <input
                type="radio"
                name="condition"
                checked={selected}
                disabled={blocked}
                onChange={() => setValue(key)}
                className="mt-1 accent-[#155DFC]"
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 text-[14px] font-medium">
                  {CONDICOES[key].label}
                  {key === player.condition && (
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-normal text-neutral-700">
                      Atual
                    </span>
                  )}
                </span>
                <span
                  className={`mt-0.5 block text-[12px] leading-4 ${blocked ? "" : "text-neutral-500"}`}
                >
                  {DESCRIPTIONS[key]}
                </span>
                {blocked && (
                  <span className="mt-0.5 flex items-center gap-1 text-[12px]">
                    <Lock size={11} strokeWidth={1.8} />
                    De Doente não passa direto para Apto.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {value === "DOENTE" && player.condition !== "DOENTE" && starter && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-[12px] leading-4 text-amber-800">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-medium">{player.name} é titular</p>
            <p className="mt-0.5">
              Ao passar a Doente, ele sai da escalação, e o {clubName ?? "clube"} só volta a jogar
              partidas depois de escalar de novo os 5 titulares.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
        >
          <CircleAlert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-4 border-t border-neutral-200" />
      <ModalActions>
        <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || value === player.condition}
          className={btnPrimary}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Salvar condição
        </button>
      </ModalActions>
    </Modal>
  );
}
