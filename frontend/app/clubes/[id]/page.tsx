"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Check,
  CircleAlert,
  ClipboardList,
  Coins,
  History,
  HandCoins,
  Landmark,
  Loader2,
  Shirt,
  ShoppingCart,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppShell, useSidebarData } from "@/src/components/AppShell";
import { Toast, type ToastData } from "@/src/components/Toast";
import {
  FLASH_KEY,
  LIMITE_ELENCO,
  TETO_MULTA,
  clubsService,
  type ClubeDetalhe,
  type JogadorDoClube,
} from "@/src/services/clubs";
import { formatMoney } from "@/src/utils/format";

type Tab = "elenco" | "escalacao" | "historico";

const CONDITIONS: Record<string, { label: string; className: string }> = {
  APTO: { label: "Apto", className: "bg-green-50 text-green-700" },
  MAL_CONDICIONADO: {
    label: "Mal condicionado",
    className: "bg-amber-50 text-amber-700",
  },
  DOENTE: { label: "Doente", className: "bg-red-50 text-red-700" },
};

export default function ClubePage() {
  // useParams precisa de Suspense com cacheComponents ativo.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafafa]" />}>
      <ClubeRoute />
    </Suspense>
  );
}

function ClubeRoute() {
  const params = useParams<{ id: string }>();
  // key: ao trocar de clube pela barra lateral, o estado da tela é reiniciado.
  return <ClubeDetalhePage key={params.id} id={Number(params.id)} />;
}

function ClubeDetalhePage({ id }: { id: number }) {
  const validId = Number.isInteger(id) && id > 0;

  const sidebar = useSidebarData();
  const reloadSidebar = sidebar.reload;

  const [club, setClub] = useState<ClubeDetalhe | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState(validId ? "" : "Clube não encontrado.");
  const [tab, setTab] = useState<Tab>("elenco");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [sellTarget, setSellTarget] = useState<JogadorDoClube | null>(null);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;

    Promise.all([
      clubsService.get(id),
      clubsService.transactionsCount(id).catch(() => 0),
    ])
      .then(([detail, history]) => {
        if (cancelled) return;
        setClub(detail);
        setHistoryCount(history);
        setLoadedAt(new Date());
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setClub(null);
        setError(
          err instanceof Error ? err.message : "Não foi possível carregar o clube.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, validId, reloadToken]);

  // Aviso deixado pela tela de cadastro ("Clube criado"). Lê o sessionStorage
  // (disponível só no navegador) e o consome na hora, para não reaparecer.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY);
      if (!raw) return;
      sessionStorage.removeItem(FLASH_KEY);
      const flash = JSON.parse(raw) as { title: string; description?: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com sessionStorage (sistema externo)
      setToast({ id: Date.now(), variant: "success", ...flash });
    } catch {
      // Aviso opcional: ignora falhas de leitura.
    }
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  function refresh() {
    setLoading(true);
    setReloadToken((value) => value + 1);
    reloadSidebar();
  }

  const players = club?.players ?? [];

  async function confirmSell(player: JogadorDoClube) {
    try {
      const result = await clubsService.sell(player.id);
      setSellTarget(null);
      setToast({
        id: Date.now(),
        variant: "success",
        title: `${player.name} vendido`,
        description: `Caixa: ${formatMoney(result.club_cash)} moedas (${result.cash_change >= 0 ? "+" : ""}${formatMoney(result.cash_change)}).`,
      });
      refresh();
    } catch (err) {
      setSellTarget(null);
      setToast({
        id: Date.now(),
        variant: "error",
        title: "Não foi possível vender o jogador",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <AppShell
      sidebar={sidebar}
      crumbs={[
        { label: "Mercado" },
        { label: "Clubes", href: "/clubes" },
        { label: club?.name ?? "Clube" },
      ]}
      activeSection="clubes"
      activeClubId={validId ? id : null}
      onRefresh={refresh}
      refreshing={loading}
    >
      <div className="mx-auto max-w-[1180px]">
        {error && !club && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
          >
            <CircleAlert size={16} strokeWidth={1.9} className="shrink-0" />
            <span className="flex-1">{error}</span>
            {validId && (
              <button
                type="button"
                onClick={refresh}
                className="font-medium underline underline-offset-2"
              >
                Tentar novamente
              </button>
            )}
            <Link href="/clubes" className="font-medium underline underline-offset-2">
              Voltar para clubes
            </Link>
          </div>
        )}

        {!club && loading && <DetailSkeleton />}

        {club && (
          <>
            {/* Cabeçalho */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[12px] font-semibold">
                  {club.acronym}
                </span>
                <div>
                  <h1 className="text-[20px] font-semibold leading-7 tracking-tight">
                    {club.name}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium shadow-sm">
                      Sigla {club.acronym}
                    </span>
                    <span className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium shadow-sm">
                      <Shirt size={11} strokeWidth={1.7} />
                      {players.length} de {LIMITE_ELENCO} jogadores
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href="/jogadores"
                className="flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95"
              >
                <ShoppingCart size={14} strokeWidth={1.8} />
                Comprar jogadores
              </Link>
            </div>

            {/* Indicadores */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Caixa"
                icon={Wallet}
                value={formatMoney(club.cash)}
                unit="moedas"
                hint="Só muda por compras e vendas"
              />
              <StatCard
                title="Valor do elenco"
                icon={Coins}
                value={formatMoney(club.squad_value)}
                unit="moedas"
                hint="Soma dos valores de mercado"
              />
              <StatCard
                title="Patrimônio"
                icon={Landmark}
                value={formatMoney(club.net_worth)}
                unit="moedas"
                hint="Caixa + valor do elenco"
              />
              <StatCard
                title="Elenco"
                icon={Shirt}
                value={`${players.length} de ${LIMITE_ELENCO}`}
                hint={`Limite de ${LIMITE_ELENCO} jogadores`}
              />
            </div>

            {/* Abas */}
            <div
              role="tablist"
              aria-label="Seções do clube"
              className="mt-6 flex items-center gap-5 border-b border-neutral-200"
            >
              <TabButton
                active={tab === "elenco"}
                onClick={() => setTab("elenco")}
                icon={Shirt}
                label="Elenco"
                count={players.length}
              />
              <TabButton
                active={tab === "escalacao"}
                onClick={() => setTab("escalacao")}
                icon={ClipboardList}
                label="Escalação"
              />
              <TabButton
                active={tab === "historico"}
                onClick={() => setTab("historico")}
                icon={History}
                label="Histórico"
                count={historyCount}
              />
            </div>

            <div role="tabpanel" className="mt-4">
              {tab === "elenco" && (
                <Squad
                  players={players}
                  calculatedAt={loadedAt}
                  onSell={setSellTarget}
                />
              )}
              {tab === "escalacao" && (
                <Placeholder
                  icon={ClipboardList}
                  title="Escalação"
                  text="A montagem da escalação será implementada na próxima etapa."
                />
              )}
              {tab === "historico" && (
                <Placeholder
                  icon={History}
                  title="Histórico"
                  text="O histórico de compras e vendas será implementado na próxima etapa."
                />
              )}
            </div>
          </>
        )}
      </div>

      {sellTarget && (
        <SellModal
          player={sellTarget}
          onCancel={() => setSellTarget(null)}
          onConfirm={() => confirmSell(sellTarget)}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function StatCard({
  title,
  icon: Icon,
  value,
  unit,
  hint,
}: {
  title: string;
  icon: LucideIcon;
  value: string;
  unit?: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[13px] text-neutral-600">
        {title}
        <Icon size={15} strokeWidth={1.6} className="text-neutral-500" />
      </div>
      <p className="mt-2 text-[24px] font-semibold leading-8 tracking-tight tabular-nums">
        {value}
        {unit && (
          <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-1 text-[12px] text-neutral-500">{hint}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-[13px] transition ${
        active
          ? "border-[#155DFC] font-medium text-neutral-950"
          : "border-transparent text-neutral-600 hover:text-neutral-950"
      }`}
    >
      <Icon size={14} strokeWidth={1.7} />
      {label}
      {count !== undefined && (
        <span
          className={`rounded-md px-1.5 text-[11px] ${
            active ? "bg-[#155DFC]/10 text-[#155DFC]" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

const TZ = "America/Sao_Paulo";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDateTime(date: Date) {
  return `${formatDate(date.toISOString())}, ${formatTime(date.toISOString())}`;
}

function fineClass(rate: number) {
  if (rate <= 0) return "border-green-200 bg-green-50 text-green-700";
  if (rate >= 20) return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

/** Mesma regra do backend (market.service.ts), usada só para a prévia da venda. */
function previewSale(player: JogadorDoClube) {
  const value = player.market_value;
  const rate = player.contract?.penalty_rate ?? 0;
  const purchase = player.contract?.purchase_value ?? value;
  const penalty = Math.min(TETO_MULTA, Math.round(value * rate) / 100);
  const profit = value - purchase;
  const commission =
    profit <= 0 ? 0 : Math.min(profit, 10) * 0.1 + Math.max(profit - 10, 0) * 0.2;
  return { value, penalty, commission, credit: value - penalty - commission };
}

function Squad({
  players,
  calculatedAt,
  onSell,
}: {
  players: ClubeDetalhe["players"];
  calculatedAt: Date | null;
  onSell: (player: JogadorDoClube) => void;
}) {
  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
          <Shirt size={18} strokeWidth={1.6} />
        </span>
        <p className="mt-4 text-[14px] font-semibold">Nenhum jogador no elenco</p>
        <p className="mt-1.5 max-w-[400px] text-[12px] leading-5 text-neutral-500">
          Compre jogadores livres para montar o elenco. O limite é de{" "}
          {LIMITE_ELENCO} jogadores, e o custo de cada compra não pode passar de
          50% do caixa.
        </p>
        <Link
          href="/jogadores"
          className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50"
        >
          <Users size={14} strokeWidth={1.7} />
          Ver jogadores livres
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="px-4 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold">Elenco</h2>
        <p className="mt-0.5 text-[12px] text-neutral-500">
          Ordem por posição (GOL, ZAG, LAT, MEI, ATA), depois pelo nome. Contrato
          calculado para uma venda agora.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-neutral-50 text-[12px] text-neutral-500">
              <th scope="col" className="px-4 py-2.5 text-left font-normal">Jogador</th>
              <th scope="col" className="px-3 py-2.5 text-left font-normal">Posição</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Overall</th>
              <th scope="col" className="px-3 py-2.5 text-left font-normal">Condição</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Valor de mercado</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Valor de compra</th>
              <th scope="col" className="px-3 py-2.5 text-left font-normal">Fim da fidelidade</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Dias restantes</th>
              <th scope="col" className="px-3 py-2.5 text-left font-normal">% de multa</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const condition = CONDITIONS[player.condition];
              const contract = player.contract;
              const initials = player.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();

              return (
                <tr key={player.id} className="border-t border-neutral-200">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600">
                        {initials}
                      </span>
                      <span className="whitespace-nowrap font-medium">{player.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium">
                      {player.position}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{player.overall}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ${condition?.className ?? "bg-neutral-100"}`}
                    >
                      <span aria-hidden className="text-[8px]">●</span>
                      {condition?.label ?? player.condition}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {formatMoney(player.market_value)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-neutral-500">
                    {contract ? formatMoney(contract.purchase_value) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {contract ? (
                      <>
                        <p className="whitespace-nowrap tabular-nums">{formatDate(contract.loyalty_until)}</p>
                        <p className="text-[11px] tabular-nums text-neutral-500">{formatTime(contract.loyalty_until)}</p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {contract
                      ? new Intl.NumberFormat("pt-BR").format(contract.remaining_days ?? 0)
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {contract ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${fineClass(contract.penalty_rate ?? 0)}`}
                      >
                        {(contract.penalty_rate ?? 0) === 0 && <Check size={11} strokeWidth={2.2} />}
                        {contract.penalty_rate ?? 0}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onSell(player)}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 text-[12px] font-medium shadow-sm transition hover:bg-neutral-50"
                    >
                      <HandCoins size={13} strokeWidth={1.7} />
                      Vender
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-neutral-200 px-4 py-3 text-[11px] text-neutral-500">
        Valor de mercado, dias restantes e % de multa calculados para uma venda
        agora{calculatedAt ? ` (${formatDateTime(calculatedAt)})` : ""}. A multa
        tem teto de {formatMoney(TETO_MULTA)}.
      </p>
    </div>
  );
}

function SellModal({
  player,
  onCancel,
  onConfirm,
}: {
  player: JogadorDoClube;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const preview = previewSale(player);
  const rate = player.contract?.penalty_rate ?? 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, submitting]);

  async function submit() {
    setSubmitting(true);
    await onConfirm();
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Vender ${player.name}`}>
      <div className="w-full max-w-[420px] rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Vender {player.name}?</h2>
            <p className="mt-1 text-[12px] leading-5 text-neutral-500">
              O jogador volta a ficar livre e sai da escalação. Os valores abaixo
              são uma prévia; o cálculo final é feito pela API na hora da venda.
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={submitting} aria-label="Fechar" className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100">
            <X size={16} />
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-[13px]">
          <Row label="Valor de mercado" value={formatMoney(preview.value)} />
          <Row label={`Multa de fidelidade (${rate}%)`} value={`− ${formatMoney(preview.penalty)}`} />
          <Row label="Comissão sobre o lucro" value={`− ${formatMoney(preview.commission)}`} />
          <div className="border-t border-neutral-200 pt-2">
            <Row label="Entra no caixa" value={`${formatMoney(preview.credit)} moedas`} strong />
          </div>
        </dl>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={submitting} className="h-9 rounded-lg border border-neutral-300 px-4 text-[13px] font-medium hover:bg-neutral-50">
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={submitting} className="flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm hover:brightness-95 disabled:opacity-60">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Confirmar venda
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-600">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

function Placeholder({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
        <Icon size={18} strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-[14px] font-semibold">{title}</p>
      <p className="mt-1.5 max-w-[400px] text-[12px] leading-5 text-neutral-500">{text}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="h-10 w-72 rounded-lg bg-neutral-100" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[104px] rounded-xl bg-neutral-100" />
        ))}
      </div>
      <div className="mt-6 h-48 rounded-xl bg-neutral-100" />
    </div>
  );
}
