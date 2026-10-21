"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BarChart3,
  Coins,
  HeartPulse,
  Pencil,
  ShoppingCart,
  Tag,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/src/components/players/Avatar";
import { ConditionBadge } from "@/src/components/players/PlayerBits";
import { btnPrimary, btnSecondary } from "@/src/components/Modal";
import type { Clube, Jogador } from "@/src/types";
import { formatMoney } from "@/src/utils/format";

const ATTRIBUTES = [
  { key: "pace", label: "Velocidade" },
  { key: "shooting", label: "Finalização" },
  { key: "passing", label: "Passe" },
  { key: "dribbling", label: "Drible" },
  { key: "defending", label: "Defesa" },
  { key: "physical", label: "Físico" },
] as const;

/** Painel de detalhes do jogador, aberto na lateral direita. */
export function PlayerDrawer({
  player,
  club,
  onClose,
  onEdit,
  onCondition,
  onBuy,
}: {
  player: Jogador;
  club?: Clube;
  onClose: () => void;
  onEdit: () => void;
  onCondition: () => void;
  onBuy: () => void;
}) {
  const [shown, setShown] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.querySelector('[aria-modal="true"]')) closeRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const free = player.club_id === null;

  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <button
        type="button"
        aria-label="Fechar detalhes"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
        />

      <aside
        role="dialog"
        aria-label={`Detalhes de ${player.name}`}
        className={`absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-200 ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start gap-3 border-b border-neutral-200 px-5 py-4">
          <Avatar id={player.id} name={player.name} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-semibold">
              {player.name}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium">
                {player.position}
              </span>
              <ConditionBadge condition={player.condition} />
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium">
                {free ? "Livre" : (club?.acronym ?? `Clube #${player.club_id}`)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X size={17} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={Coins}
              label="Valor de mercado"
              value={formatMoney(player.market_value)}
              caption="Calculado automaticamente"
            />
            <Stat
              icon={Tag}
              label="Valor base"
              value={formatMoney(player.base_value)}
              caption="Calculado no cadastro"
            />
            <Stat
              icon={BarChart3}
              label="Overall"
              value={String(player.overall)}
              caption="Calculado pela posição"
            />
            <Stat
              icon={TrendingUp}
              label="Potencial"
              value={String(player.potential)}
              caption="Informado no cadastro"
            />
          </div>

          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold">
                Indicadores técnicos
              </h3>
              <span className="text-[11px] text-neutral-500">
                Escala de 1 a 99
              </span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {ATTRIBUTES.map(({ key, label }) => (
                <li key={key} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[76px] shrink-0 text-neutral-600">
                    {label}
                  </span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[#155DFC]/20"
                      style={{ width: `${player.potential}%` }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[#155DFC]"
                      style={{ width: `${player[key]}%` }}
                    />
                  </span>
                  <span className="w-6 text-right font-medium tabular-nums">
                    {player[key]}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#155DFC]" /> Valor do
                atributo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#155DFC]/20" /> Até o
                potencial ({player.potential}), que nenhum atributo passa
              </span>
            </p>
          </section>

          <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 text-[13px]">
            <Row label="Idade" value={`${player.age} anos`} />
            <Row label="Agilidade" value={String(player.agility)} />
            <Row
              label="Clube"
              value={
                free ? (
                  "Livre"
                ) : (
                  <Link
                    href={`/clubes/${player.club_id}`}
                    className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-700"
                  >
                    {club?.name ?? `Clube #${player.club_id}`}
                  </Link>
                )
              }
            />
          </dl>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className={`${btnSecondary} flex items-center gap-1.5 whitespace-nowrap`}
            >
              <Pencil size={13} strokeWidth={1.8} /> Editar
            </button>
            <button
              type="button"
              onClick={onCondition}
              className={`${btnSecondary} flex items-center gap-1.5 whitespace-nowrap`}
            >
              <HeartPulse size={13} strokeWidth={1.8} /> Alterar condição
            </button>
          </div>
          {free && (
            <button
              type="button"
              onClick={onBuy}
              className={`${btnPrimary} whitespace-nowrap`}
            >
              <ShoppingCart size={13} strokeWidth={1.8} /> Comprar
            </button>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function Stat({ icon: Icon, label, value, caption }: { icon: LucideIcon; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <div className="flex items-center justify-between text-[12px] text-neutral-500">
        {label}
        <Icon size={14} strokeWidth={1.6} />
      </div>
      <p className="mt-1.5 text-[22px] font-semibold leading-7 tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{caption}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
