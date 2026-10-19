"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Info,
  Loader2,
  RefreshCw,
  Shield,
  ShoppingCart,
  X,
} from "lucide-react";
import { api } from "@/src/services/api";
import type { Clube, Jogador } from "@/src/types";
import { formatMoney } from "@/src/utils/format";
import {
  defaultLoyalty,
  formatBrasilia,
  maskDate,
  maskTime,
  parseLoyalty,
  type LoyaltyFieldErrors,
} from "@/src/utils/loyalty";

/** Resposta de POST /players/{id}/buy. */
export interface CompraResposta {
  id: number;
  club_id: number;
  player_id: number;
  player_name: string;
  type: "COMPRA";
  value: number;
  fee: number;
  penalty: number;
  profit: number | null;
  cash_change: number;
  created_at: string;
  contract: {
    purchase_value: number;
    loyalty_until: string;
    status: string;
  };
  club_cash: number;
}

interface BuyModalProps {
  player: Jogador;
  clubs: Clube[];
  onClose: () => void;
  /** Chamado assim que a API confirma a compra; o modal segue aberto mostrando o resumo. */
  onBought: (result: CompraResposta, clubName: string) => void;
}

/** A requisição nem chegou à API (rede fora do ar, servidor inacessível). */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (!(err instanceof Error)) return false;
  return (
    err.name === "NetworkError" ||
    /failed to fetch|networkerror|network request failed|load failed/i.test(err.message)
  );
}

interface Banner {
  title: string;
  message: string;
  offline: boolean;
}

const POSITIONS: Record<string, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LAT: "Lateral",
  MEI: "Meio-campo",
  ATA: "Atacante",
};

const BLUE = "#155DFC";

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function BuyModal({ player, clubs, onClose, onBought }: BuyModalProps) {
  const [clubId, setClubId] = useState("");
  const [date, setDate] = useState(() => defaultLoyalty().date);
  const [time, setTime] = useState(() => defaultLoyalty().time);
  const [clubError, setClubError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoyaltyFieldErrors>({});
  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CompraResposta | null>(null);

  const sendingRef = useRef(false);
  const clubRef = useRef<HTMLSelectElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  const selectedClub = clubs.find((club) => String(club.id) === clubId);

  // Foco inicial e bloqueio da rolagem do fundo.
  useEffect(() => {
    clubRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Esc fecha, exceto durante o envio.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;

    // Só validações de um campo sozinho; as regras de negócio ficam com a API.
    if (!selectedClub) {
      setClubError("Escolha o clube comprador.");
      clubRef.current?.focus();
      return;
    }
    setClubError("");

    const parsed = parseLoyalty(date, time);
    if (parsed.errors) {
      setFieldErrors(parsed.errors);
      (parsed.errors.date ? dateRef : timeRef).current?.focus();
      return;
    }
    setFieldErrors({});

    sendingRef.current = true;
    setSubmitting(true);
    setBanner(null);

    try {
      const response = await api.post<CompraResposta>(`/players/${player.id}/buy`, {
        club_id: selectedClub.id,
        loyalty_until: parsed.value,
      });
      setResult(response);
      onBought(response, selectedClub.name);
    } catch (err) {
      if (isNetworkError(err)) {
        setBanner({
          title: "Sem conexão",
          message: "A compra não foi confirmada. Verifique a conexão e tente de novo.",
          offline: true,
        });
      } else {
        setBanner({
          title: "Compra recusada",
          message: err instanceof Error ? err.message : "Erro ao processar requisição",
          offline: false,
        });
      }
    } finally {
      sendingRef.current = false;
      setSubmitting(false);
    }
  }

  const overlay = (children: ReactNode, labelId: string, width: string) => (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={`max-h-full w-full ${width} overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]`}
      >
        {children}
      </div>
    </div>
  );

  /* ------------------------------ Sucesso ------------------------------ */
  if (result) {
    const clubName =
      clubs.find((club) => club.id === result.club_id)?.name ?? selectedClub?.name ?? "";
    const totalCost = Math.round((result.value + result.fee) * 100) / 100;

    return overlay(
      <>
        <div className="flex items-start justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8FFF0] text-[#087A37]">
            <CheckCircle2 size={18} strokeWidth={1.8} />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 rounded-md p-1 text-neutral-700 transition hover:bg-neutral-100"
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>

        <h2 id="compra-titulo" className="mt-3 text-[17px] font-semibold">
          Compra concluída
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          {result.player_name} agora é do {clubName}.
        </p>

        <dl className="mt-4 overflow-hidden rounded-xl border border-neutral-200 text-[13px]">
          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2.5">
            <div>
              <dt className="text-neutral-500">Valor</dt>
              <p className="text-[11px] text-neutral-500">
                Valor de mercado no momento da compra
              </p>
            </div>
            <dd className="font-semibold tabular-nums">{formatMoney(result.value)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2.5">
            <div>
              <dt className="text-neutral-500">Taxa</dt>
              <p className="text-[11px] text-neutral-500">
                {result.fee > 0
                  ? "5% do valor, porque passa de 30,00"
                  : "Sem taxa, porque o valor não passa de 30,00"}
              </p>
            </div>
            <dd className="font-semibold tabular-nums">{formatMoney(result.fee)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
            <div>
              <dt className="font-semibold">Custo total</dt>
              <p className="text-[11px] text-neutral-500">Valor + taxa</p>
            </div>
            <dd className="text-[16px] font-bold tabular-nums">
              {formatMoney(totalCost)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2.5">
            <dt className="text-neutral-500">Fim da fidelidade</dt>
            <dd className="font-semibold tabular-nums">
              {formatBrasilia(result.contract.loyalty_until)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2.5">
            <dt className="text-neutral-500">Contrato</dt>
            <dd>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#087A37]/25 bg-[#E8FFF0] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#087A37]">
                <span aria-hidden>●</span>
                {result.contract.status}
              </span>
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 bg-neutral-50 px-4 py-2.5">
            <dt className="font-semibold">Novo caixa do {clubName}</dt>
            <dd className="text-[16px] font-bold tabular-nums">
              {formatMoney(result.club_cash)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <Link
            href={`/clubes/${result.club_id}`}
            className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50"
          >
            Ver clube
            <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95"
            style={{ backgroundColor: BLUE }}
          >
            Fechar
          </button>
        </div>
      </>,
      "compra-titulo",
      "max-w-[420px]",
    );
  }

  /* ------------------------------ Formulário ------------------------------ */
  const inputBase =
    "h-9 w-full rounded-lg border bg-white text-[13px] outline-none transition disabled:bg-neutral-50";
  const inputOk =
    "border-neutral-300 focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/15";
  const inputBad = "border-red-500 focus:ring-2 focus:ring-red-500/15";

  return overlay(
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="compra-titulo" className="text-[17px] font-semibold">
            Comprar jogador
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500">
            Escolha o clube comprador e até quando vai a fidelidade do contrato.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Fechar"
          className="-mr-1 -mt-1 rounded-md p-1 text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4">
        {banner && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-red-700"
          >
            <CircleAlert size={15} strokeWidth={1.9} className="mt-0.5 shrink-0" />
            <div className="text-[13px] leading-5">
              <p className="font-semibold">{banner.title}</p>
              <p>{banner.message}</p>
            </div>
          </div>
        )}

        {/* Jogador */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef0f5] text-[11px] font-semibold text-[#54596a]">
              {initialsOf(player.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{player.name}</p>
              <p className="text-[11px] text-neutral-500">
                {player.position} · {POSITIONS[player.position] ?? player.position} ·{" "}
                {player.age} anos
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-neutral-500">Valor de mercado</p>
            <p className="text-[16px] font-bold tabular-nums">
              {formatMoney(player.market_value)}
            </p>
          </div>
        </div>

        {/* Clube comprador */}
        <div className="mt-4">
          <label htmlFor="buy-club" className="text-[13px] font-medium">
            Clube comprador
          </label>
          <div className="relative mt-1.5">
            <Shield
              size={14}
              strokeWidth={1.7}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
            />
            <select
              ref={clubRef}
              id="buy-club"
              value={clubId}
              onChange={(event) => {
                setClubId(event.target.value);
                setClubError("");
              }}
              disabled={submitting}
              aria-invalid={Boolean(clubError)}
              aria-describedby="buy-club-help"
              className={`${inputBase} appearance-none pl-9 pr-8 ${clubError ? inputBad : inputOk}`}
            >
              <option value="">Selecione o clube</option>
              {clubs.map((club) => (
                <option key={club.id} value={String(club.id)}>
                  {club.name}
                  {club.acronym ? ` (${club.acronym})` : ""}
                  {typeof club.cash === "number" ? ` · caixa ${formatMoney(club.cash)}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={1.7}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600"
            />
          </div>
          <p
            id="buy-club-help"
            className={`mt-1.5 text-[11px] leading-4 ${clubError ? "text-red-600" : "text-neutral-500"}`}
          >
            {clubError ||
              (selectedClub && typeof selectedClub.cash === "number"
                ? `Caixa atual: ${formatMoney(selectedClub.cash)}. O custo total (valor + taxa) pode ir até 50% do caixa.`
                : "O custo total (valor + taxa) pode ir até 50% do caixa do clube.")}
          </p>
        </div>

        {/* Fim da fidelidade */}
        <div className="mt-4">
          <label htmlFor="buy-date" className="text-[13px] font-medium">
            Fim da fidelidade
          </label>
          <div className="mt-1.5 grid grid-cols-[1fr_120px] gap-2">
            <div className="relative">
              <CalendarDays
                size={14}
                strokeWidth={1.7}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
              />
              <input
                ref={dateRef}
                id="buy-date"
                value={date}
                onChange={(event) => {
                  setDate(maskDate(event.target.value));
                  setFieldErrors((current) => ({ ...current, date: undefined }));
                }}
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                autoComplete="off"
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.date)}
                aria-describedby="buy-date-help"
                className={`${inputBase} pl-9 pr-3 tabular-nums ${fieldErrors.date ? inputBad : inputOk}`}
              />
            </div>
            <div className="relative">
              <Clock3
                size={14}
                strokeWidth={1.7}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
              />
              <input
                ref={timeRef}
                id="buy-time"
                aria-label="Hora do fim da fidelidade"
                value={time}
                onChange={(event) => {
                  setTime(maskTime(event.target.value));
                  setFieldErrors((current) => ({ ...current, time: undefined }));
                }}
                inputMode="numeric"
                placeholder="hh:mm"
                autoComplete="off"
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.time)}
                aria-describedby="buy-date-help"
                className={`${inputBase} pl-9 pr-3 tabular-nums ${fieldErrors.time ? inputBad : inputOk}`}
              />
            </div>
          </div>
          <p
            id="buy-date-help"
            className={`mt-1.5 text-[11px] leading-4 ${
              fieldErrors.date || fieldErrors.time ? "text-red-600" : "text-neutral-500"
            }`}
          >
            {fieldErrors.date ||
              fieldErrors.time ||
              "Depois do momento da compra e até 1.095 dias. Horário de Brasília; enviado com o fuso (-03:00)."}
          </p>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[12px] leading-4 text-neutral-600">
          <Info size={14} strokeWidth={1.7} className="mt-px shrink-0" />
          A taxa é de 5% do valor de mercado, só quando ele passa de 30,00. Taxa,
          custo e novo caixa são calculados ao confirmar.
        </div>

        {submitting && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600"
          >
            <Info size={14} strokeWidth={1.7} className="shrink-0" />
            Enviando a compra. Os botões ficam desabilitados até a resposta.
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
            style={{ backgroundColor: BLUE }}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : banner?.offline ? (
              <RefreshCw size={14} strokeWidth={1.8} />
            ) : (
              <ShoppingCart size={14} strokeWidth={1.8} />
            )}
            {submitting
              ? "Comprando…"
              : banner?.offline
                ? "Tentar de novo"
                : "Confirmar compra"}
          </button>
        </div>
      </form>
    </>,
    "compra-titulo",
    "max-w-[460px]",
  );
}
