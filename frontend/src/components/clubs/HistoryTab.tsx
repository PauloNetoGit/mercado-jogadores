"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Download,
  HandCoins,
  History,
  Loader2,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import { ErrorCard, LoadingLabel } from "@/src/components/ListStates";
import { Avatar } from "@/src/components/players/Avatar";
import type { ToastData } from "@/src/components/Toast";
import {
  CAIXA_INICIAL,
  clubsService,
  type FiltroHistorico,
  type HistoricoClube,
  type TipoTransacao,
  type Transacao,
} from "@/src/services/clubs";
import { formatMoney } from "@/src/utils/format";

const MINUS = "−";

/** Valor com sinal explícito: +25,84 / −22,25 / 0,00. */
function signed(value: number) {
  const text = formatMoney(Math.abs(value));
  if (value > 0) return `+${text}`;
  if (value < 0) return `${MINUS}${text}`;
  return text;
}

/** "2026-11-08T11:00:00-03:00" -> { date: "08/11/2026", time: "11:00" } (a API já manda em Brasília). */
function splitBrasilia(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return match
    ? {
        date: `${match[3]}/${match[2]}/${match[1]}`,
        time: `${match[4]}:${match[5]}`,
      }
    : { date: iso, time: "" };
}

function tone(value: number) {
  if (value > 0) return "text-green-700";
  if (value < 0) return "text-red-600";
  return "text-neutral-500";
}

interface Loaded {
  key: string;
  data?: HistoricoClube;
  error?: { kind: "refused" | "network"; message: string };
}

export function HistoryTab({
  clubId,
  clubName,
  cash,
  onToast,
}: {
  clubId: number;
  clubName: string;
  /** Caixa atual do clube, para a conferência "300,00 + soma das variações = caixa atual". */
  cash: number;
  onToast: (toast: Omit<ToastData, "id">) => void;
}) {
  const [showBuy, setShowBuy] = useState(true);
  const [showSell, setShowSell] = useState(true);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [everything, setEverything] = useState<Transacao[]>([]);
  const [exporting, setExporting] = useState(false);

  const types = useMemo<TipoTransacao[] | undefined>(
    () => (showBuy && showSell ? undefined : showBuy ? ["COMPRA"] : ["VENDA"]),
    [showBuy, showSell],
  );
  const filter: FiltroHistorico = useMemo(() => ({ types, playerId }), [types, playerId]);
  const filtered = Boolean(types) || playerId !== null;
  const key = `${clubId}|${types?.join(",") ?? ""}|${playerId ?? ""}|${retry}`;
  const loading = !loaded || loaded.key !== key;

  // Lista conforme os filtros atuais.
  useEffect(() => {
    let cancelled = false;
    clubsService
      .transactions(clubId, filter)
      .then((data) => {
        if (!cancelled) setLoaded({ key, data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          error:
            err instanceof TypeError
              ? {
                  kind: "network",
                  message: "A API não respondeu. Verifique a conexão e tente de novo.",
                }
              : {
                  kind: "refused",
                  message:
                    err instanceof Error ? err.message : "Não foi possível carregar o histórico.",
                },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, filter, key]);

  // Jogadores do seletor: todos os que tiveram compra ou venda no clube, sem filtro (inclui vendidos).
  useEffect(() => {
    let cancelled = false;
    clubsService
      .transactions(clubId)
      .then((response) => {
        if (!cancelled) setEverything(response.data);
      })
      .catch(() => {
        // O seletor é opcional: sem a lista, fica só "todos".
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, retry]);

  const options = useMemo(() => {
    const seen = new Map<number, string>();
    // A lista vem da mais recente para a mais antiga: vale o nome mais recente.
    for (const tx of everything)
      if (!seen.has(tx.player_id)) seen.set(tx.player_id, tx.player_name);
    if (playerId !== null && !seen.has(playerId)) seen.set(playerId, playerName);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [everything, playerId, playerName]);

  const data = loaded?.data;
  const error = loaded?.error;

  function toggleType(kind: TipoTransacao) {
    // Sempre sobra pelo menos um tipo marcado: a API recusa `type` vazio.
    if (kind === "COMPRA") {
      if (showBuy && !showSell) return;
      setShowBuy(!showBuy);
    } else {
      if (showSell && !showBuy) return;
      setShowSell(!showSell);
    }
  }

  function selectPlayer(value: string) {
    if (!value) {
      setPlayerId(null);
      setPlayerName("");
      return;
    }
    const id = Number(value);
    setPlayerId(id);
    setPlayerName(options.find((option) => option.id === id)?.name ?? "");
  }

  function clearFilters() {
    setShowBuy(true);
    setShowSell(true);
    setPlayerId(null);
    setPlayerName("");
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await clubsService.exportTransactions(clubId, filter);
      const filename = `historico-clube-${clubId}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const applied: string[] = [];
      if (types) applied.push(`filtro de tipo ${showBuy ? "Compra" : "Venda"}`);
      if (playerId !== null) applied.push(`filtro de jogador ${playerName}`);
      onToast({
        variant: "success",
        title: "CSV baixado",
        description:
          applied.length === 0
            ? `${filename}, sem filtros.`
            : `${filename}, com o ${applied.join(" e o ")} ${applied.length > 1 ? "aplicados" : "aplicado"}.`,
      });
    } catch (err) {
      onToast({
        variant: "error",
        title: "Não foi possível baixar o CSV",
        description:
          err instanceof TypeError
            ? "Sem conexão com a API. Tente de novo."
            : err instanceof Error
              ? err.message
              : undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  const note = data ? footnote() : null;

  function footnote() {
    if (!data) return null;
    if (data.data.length === 0) {
      return filtered
        ? "Os totais respeitam os filtros: sem transações, ficam zerados. O CSV baixa só a linha de cabeçalho."
        : "Sem transações, os totais ficam zerados. O botão Exportar CSV continua disponível e baixa só a linha de cabeçalho.";
    }
    const parts: string[] = [];
    if (playerId !== null) {
      const buys = data.data.filter((tx) => tx.type === "COMPRA").length;
      const sells = data.data.filter((tx) => tx.type === "VENDA").length;
      const what = [
        buys > 0 ? (buys === 1 ? "a compra" : `as ${buys} compras`) : "",
        sells > 0 ? (sells === 1 ? "a venda" : `as ${sells} vendas`) : "",
      ]
        .filter(Boolean)
        .join(" e ");
      parts.push(
        `Filtro por jogador: ${what} do ${playerName} no ${clubName}, com os totais só dessas transações.`,
      );
    }
    if (types) {
      parts.push(
        showBuy
          ? `Com o filtro “Compra”, os totais consideram só as compras (total recebido em vendas ${formatMoney(data.summary.total_received)}).`
          : `Com o filtro “Venda”, os totais consideram só as vendas (total pago em compras ${formatMoney(data.summary.total_spent)}).`,
      );
    }
    if (parts.length > 0) return `${parts.join(" ")} O CSV usa os mesmos filtros da tela.`;
    return `Os totais respeitam os filtros. ${formatMoney(CAIXA_INICIAL)} + soma das variações = caixa atual (${formatMoney(cash)}).`;
  }

  // Falha de conexão: só o cartão de erro, sem filtros nem totais (E-histórico com erro).
  if (error?.kind === "network")
    return (
      <ErrorCard
        what="o histórico"
        message="Não foi possível carregar o histórico. Os totais e a exportação ficam indisponíveis até a lista carregar."
        onRetry={() => setRetry((value) => value + 1)}
      />
    );

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {/* Cabeçalho */}
        <div className="px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Histórico de transações</h2>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                Da mais recente para a mais antiga, com o nome e os valores do momento de cada
                operação.
              </p>
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting}
              aria-busy={exporting}
              className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-70"
            >
              {exporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} strokeWidth={1.8} />
              )}
              Exportar CSV
            </button>
          </div>

          {/* Filtros */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[13px] text-neutral-500">Tipo</span>
            <TypeChip label="Compra" checked={showBuy} onClick={() => toggleType("COMPRA")} />
            <TypeChip label="Venda" checked={showSell} onClick={() => toggleType("VENDA")} />

            <span aria-hidden className="mx-1 h-6 w-px bg-neutral-200" />

            <div className="relative inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white pl-3 pr-2.5 text-[13px] shadow-sm focus-within:ring-2 focus-within:ring-[#155DFC]/25">
              <User size={14} strokeWidth={1.7} className="text-neutral-600" />
              <span className="max-w-[200px] truncate">
                Jogador: {playerId === null ? "todos" : playerName}
              </span>
              <ChevronDown size={14} className="text-neutral-500" />
              <select
                value={playerId ?? ""}
                onChange={(event) => selectPlayer(event.target.value)}
                aria-label="Filtrar por jogador"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                <option value="">Todos os jogadores</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            {filtered && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 text-[13px] font-medium text-[#155DFC] hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Corpo */}
        {error && error.kind === "refused" && playerId !== null ? (
          <div className="border-t border-neutral-200 p-4">
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
            >
              <CircleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              <div className="flex-1 text-[13px] leading-5">
                <p className="font-medium text-red-800">O filtro foi recusado</p>
                <p>{error.message}</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="border-t border-neutral-200 p-4">
            <ErrorCard
              what="o histórico"
              message={error.message}
              onRetry={() => setRetry((value) => value + 1)}
            />
          </div>
        ) : !data ? (
          <TableSkeleton />
        ) : (
          <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            {data.data.length === 0 ? (
              <EmptyState filtered={filtered} onClear={clearFilters} />
            ) : (
              <div className="overflow-x-auto border-t border-neutral-200">
                <table className="w-full min-w-[860px] text-[13px]">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-[12px] text-neutral-500">
                      <th className="px-4 py-2.5 font-medium">Data e hora</th>
                      <th className="px-3 py-2.5 font-medium">Tipo</th>
                      <th className="px-3 py-2.5 font-medium">Jogador</th>
                      <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                      <th className="px-3 py-2.5 text-right font-medium">Taxa ou comissão</th>
                      <th className="px-3 py-2.5 text-right font-medium">Multa</th>
                      <th className="px-3 py-2.5 text-right font-medium">Lucro</th>
                      <th className="px-4 py-2.5 text-right font-medium">Variação do caixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((tx) => (
                      <Row key={tx.id} tx={tx} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totais (respeitam os filtros) */}
            <div className="grid grid-cols-2 gap-px border-t border-neutral-200 bg-neutral-200 lg:grid-cols-5">
              <Summary icon={ShoppingCart} label="Total pago em compras" hint="Valor + taxa">
                {formatMoney(data.summary.total_spent)}
              </Summary>
              <Summary icon={HandCoins} label="Total recebido em vendas" hint="Crédito líquido">
                {formatMoney(data.summary.total_received)}
              </Summary>
              <Summary icon={CircleCheck} label="Taxas e comissões" hint="Somadas">
                {formatMoney(data.summary.total_fees)}
              </Summary>
              <Summary icon={TriangleAlert} label="Multas" hint="Por fidelidade">
                {formatMoney(data.summary.total_penalties)}
              </Summary>
              <Summary
                icon={data.summary.total_profit < 0 ? TrendingDown : TrendingUp}
                label="Lucro total"
                hint="Soma dos lucros, com sinal"
                valueClass={data.summary.total_profit === 0 ? "" : tone(data.summary.total_profit)}
                wide
              >
                {signed(data.summary.total_profit)}
              </Summary>
            </div>
          </div>
        )}
      </div>

      {note && <p className="mt-4 text-[12px] leading-5 text-neutral-500">{note}</p>}
    </div>
  );
}

function TypeChip({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium shadow-sm transition ${
        checked
          ? "border-[#155DFC] bg-blue-50 text-[#155DFC]"
          : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          checked ? "border-[#155DFC] bg-[#155DFC] text-white" : "border-neutral-300 bg-white"
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

function Row({ tx }: { tx: Transacao }) {
  const { date, time } = splitBrasilia(tx.created_at);
  const buy = tx.type === "COMPRA";
  const muted = (value: number) => (value === 0 ? "text-neutral-500" : "");

  return (
    <tr className="border-t border-neutral-200">
      <td className="whitespace-nowrap px-4 py-3.5 tabular-nums">
        {date} <span className="ml-1 text-neutral-500">{time}</span>
      </td>
      <td className="px-3 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
            buy
              ? "border-neutral-200 bg-white text-neutral-800"
              : "border-transparent bg-neutral-100 text-neutral-800"
          }`}
        >
          {buy ? (
            <ShoppingCart size={11} strokeWidth={1.8} />
          ) : (
            <HandCoins size={11} strokeWidth={1.8} />
          )}
          {buy ? "Compra" : "Venda"}
        </span>
      </td>
      <td className="px-3 py-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar id={tx.player_id} name={tx.player_name} size={32} />
          <span className="font-medium">{tx.player_name}</span>
        </div>
      </td>
      <td className="px-3 py-3.5 text-right tabular-nums">{formatMoney(tx.value)}</td>
      <td className={`px-3 py-3.5 text-right tabular-nums ${muted(tx.fee)}`}>
        {formatMoney(tx.fee)}
      </td>
      <td className={`px-3 py-3.5 text-right tabular-nums ${muted(tx.penalty)}`}>
        {formatMoney(tx.penalty)}
      </td>
      <td
        className={`px-3 py-3.5 text-right tabular-nums ${
          tx.profit === null ? "text-neutral-400" : tone(tx.profit)
        }`}
      >
        {tx.profit === null ? "–" : signed(tx.profit)}
      </td>
      <td className={`px-4 py-3.5 text-right font-semibold tabular-nums ${tone(tx.cash_change)}`}>
        {signed(tx.cash_change)}
      </td>
    </tr>
  );
}

function Summary({
  icon: Icon,
  label,
  hint,
  children,
  valueClass = "",
  wide = false,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  children: ReactNode;
  valueClass?: string;
  wide?: boolean;
}) {
  return (
    <div className={`bg-neutral-50 px-4 py-3.5 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className="flex items-center gap-1.5 text-[12px] text-neutral-500">
        <Icon size={13} strokeWidth={1.7} />
        {label}
      </p>
      <p className={`mt-1.5 text-[20px] font-semibold tabular-nums ${valueClass}`}>{children}</p>
      <p className="mt-0.5 text-[12px] text-neutral-500">{hint}</p>
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center border-t border-neutral-200 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
        <History size={20} strokeWidth={1.6} />
      </span>
      <p className="mt-5 text-[15px] font-semibold">
        {filtered ? "Nenhuma transação com esses filtros" : "Nenhuma transação ainda"}
      </p>
      <p className="mt-2 max-w-[400px] text-[13px] leading-5 text-neutral-500">
        {filtered
          ? "Tente outro tipo ou jogador, ou limpe os filtros para ver tudo."
          : "As compras e vendas do clube aparecem aqui, com os totais logo abaixo."}
      </p>
      {filtered && (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-[13px] font-medium text-[#155DFC] hover:underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="border-t border-neutral-200">
      <div className="px-4 py-3.5">
        <LoadingLabel label="Carregando histórico…" />
      </div>
      <div aria-hidden className="animate-pulse">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-t border-neutral-100 px-4 py-4"
          >
            <div className="h-4 w-32 rounded bg-neutral-100" />
            <div className="h-5 w-16 rounded bg-neutral-100" />
            <div className="h-8 w-8 rounded-full bg-neutral-100" />
            <div className="h-4 flex-1 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
