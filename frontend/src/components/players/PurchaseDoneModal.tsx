"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, X } from "lucide-react";
import { formatMoney } from "@/src/utils/format";

export interface PurchaseDoneData {
  playerName: string;
  clubId: number;
  clubName: string;
  value: number;
  fee: number;
  /** Fim da fidelidade já formatado (ex.: "12/11/2027, 15:00"). */
  loyaltyLabel: string;
  /** Situação do contrato devolvida pela API (ex.: "ATIVO"). */
  contractStatus: string;
  newCash: number;
}

export function PurchaseDoneModal({
  data,
  onClose,
}: {
  data: PurchaseDoneData;
  onClose: () => void;
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

  const total = Math.round((data.value + data.fee) * 100) / 100;
  const active = data.contractStatus.toUpperCase() === "ATIVO";

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
        aria-labelledby="purchase-done-title"
        className="my-auto w-full max-w-[460px] rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
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

        <h2 id="purchase-done-title" className="mt-4 text-[20px] font-semibold tracking-tight">
          Compra concluída
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          {data.playerName} agora é do {data.clubName}.
        </p>

        <dl className="mt-5 overflow-hidden rounded-xl border border-neutral-200 text-[13px]">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <dt className="text-neutral-600">Valor</dt>
              <p className="text-[11px] text-neutral-500">Valor de mercado no momento da compra</p>
            </div>
            <dd className="font-medium tabular-nums">{formatMoney(data.value)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-3">
            <div>
              <dt className="text-neutral-600">Taxa</dt>
              <p className="text-[11px] text-neutral-500">
                {data.fee > 0 ? "5% do valor, porque passa de 30,00" : "Sem taxa: o valor não passa de 30,00"}
              </p>
            </div>
            <dd className="font-medium tabular-nums">{formatMoney(data.fee)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 bg-neutral-50 px-4 py-3">
            <div>
              <dt className="font-semibold">Custo total</dt>
              <p className="text-[11px] text-neutral-500">Valor + taxa</p>
            </div>
            <dd className="text-[16px] font-semibold tabular-nums">{formatMoney(total)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-3">
            <dt className="text-neutral-600">Fim da fidelidade</dt>
            <dd className="font-medium tabular-nums">{data.loyaltyLabel}</dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-3">
            <dt className="text-neutral-600">Contrato</dt>
            <dd>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase ${
                  active
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-neutral-200 bg-neutral-50 text-neutral-700"
                }`}
              >
                <span aria-hidden className="text-[8px]">●</span>
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
          <Link
            href={`/clubes/${data.clubId}`}
            onClick={onClose}
            className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50"
          >
            Ver clube
            <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
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
