"use client";

import { useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { Modal, ModalActions, btnPrimary, btnSecondary } from "@/src/components/Modal";
import { CONDICOES, playersService } from "@/src/services/players";
import type { Condicao, Jogador } from "@/src/types";

export function ConditionModal({
  player,
  onClose,
  onChanged,
}: {
  player: Jogador;
  onClose: () => void;
  onChanged: (condition: Condicao) => void;
}) {
  const [value, setValue] = useState<Condicao>(player.condition);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (value === player.condition) return onClose();
    setSubmitting(true);
    setError("");
    try {
      await playersService.setCondition(player.id, value);
      onChanged(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a condição.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Alterar condição física"
      description={`A condição muda o desconto do valor de mercado de ${player.name}, recalculado ao salvar. Ficar Doente tira o jogador da escalação.`}
      onClose={onClose}
      busy={submitting}
    >
      <div className="space-y-2" role="radiogroup" aria-label="Condição física">
        {(Object.keys(CONDICOES) as Condicao[]).map((key) => {
          // Regra do backend: Doente não passa direto para Apto.
          const blocked = player.condition === "DOENTE" && key === "APTO";
          return (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] ${
                value === key ? "border-[#155DFC] bg-[#155DFC]/5" : "border-neutral-200"
              } ${blocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="condition"
                checked={value === key}
                disabled={blocked}
                onChange={() => setValue(key)}
              />
              <span style={{ color: CONDICOES[key].color }}>●</span>
              {CONDICOES[key].label}
              {blocked && (
                <span className="ml-auto text-[11px] text-neutral-500">
                  Doente não passa direto para Apto
                </span>
              )}
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <CircleAlert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <ModalActions>
        <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
          Cancelar
        </button>
        <button type="button" onClick={submit} disabled={submitting} className={btnPrimary}>
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Salvar
        </button>
      </ModalActions>
    </Modal>
  );
}
