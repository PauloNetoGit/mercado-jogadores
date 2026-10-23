"use client";

import { useState } from "react";
import { CircleAlert, Loader2, Trash2 } from "lucide-react";
import { Modal, ModalActions, btnSecondary } from "@/src/components/Modal";
import { PlayerSummary } from "@/src/components/players/PlayerBits";
import { playersService } from "@/src/services/players";
import type { Jogador } from "@/src/types";

export function DeletePlayerModal({
  player,
  onClose,
  onDeleted,
}: {
  player: Jogador;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      await playersService.remove(player.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o jogador.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Excluir ${player.name}?`}
      description="O jogador sai da lista e da busca, mas as transações e as partidas antigas dele continuam como foram gravadas."
      onClose={onClose}
      busy={submitting}
      width={500}
    >
      <PlayerSummary
        player={player}
        badge={
          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium">
            Livre
          </span>
        }
      />

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
          disabled={submitting}
          className="flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} strokeWidth={1.8} />
          )}
          Excluir jogador
        </button>
      </ModalActions>
    </Modal>
  );
}
