"use client";

import { useState } from "react";
import { ChevronDown, CircleAlert, Info, Loader2, RefreshCw, Shield, Swords } from "lucide-react";
import { Modal, ModalActions, btnPrimary, btnSecondary, inputClass } from "@/src/components/Modal";
import { clubsService } from "@/src/services/clubs";
import { matchesService, type PartidaDetalhe } from "@/src/services/matches";
import type { Clube } from "@/src/types";

/** Tempo mínimo do estado "Jogando…", como nas telas de compra e venda. */
const MIN_PLAYING_MS = 1000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const invalidClass = "border-red-500 focus:border-red-500 focus:ring-red-500/15";

/**
 * A API só diz "escalação completa e válida". Consulta a escalação do clube recusado
 * para dizer o motivo certo: faltam titulares ou há titular doente.
 */
async function explainLineup(clubId: number, clubName: string, fallback: string) {
  try {
    const raw = (await clubsService.lineup(clubId)) as {
      players?: { condition?: string }[];
    };
    const players = Array.isArray(raw?.players) ? raw.players : null;
    if (players) {
      if (players.length !== 5) {
        return `Escalação incompleta: o ${clubName} não tem os 5 titulares.`;
      }
      if (players.some((player) => player.condition === "DOENTE")) {
        return `Escalação inválida: o ${clubName} tem titular doente.`;
      }
    }
  } catch {
    // Sem a consulta, fica a mensagem da API.
  }
  return fallback;
}

export function NewMatchModal({
  clubs,
  defaultHomeId,
  defaultAwayId,
  onClose,
  onPlayed,
}: {
  clubs: Clube[];
  /** Pré-seleção (a última partida jogada). */
  defaultHomeId?: number;
  defaultAwayId?: number;
  onClose: () => void;
  /** A API devolveu a partida jogada, já com o placar e os 6 duelos. */
  onPlayed: (match: PartidaDetalhe) => void;
}) {
  const exists = (id?: number) =>
    id !== undefined && clubs.some((club) => club.id === id) ? id : undefined;
  const initialHome = exists(defaultHomeId) ?? clubs[0]?.id;
  const initialAway =
    exists(defaultAwayId) !== undefined && exists(defaultAwayId) !== initialHome
      ? exists(defaultAwayId)
      : clubs.find((club) => club.id !== initialHome)?.id;

  const [homeId, setHomeId] = useState(initialHome !== undefined ? String(initialHome) : "");
  const [awayId, setAwayId] = useState(initialAway !== undefined ? String(initialAway) : "");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [errorSide, setErrorSide] = useState<"home" | "away" | null>(null);
  const [networkError, setNetworkError] = useState(false);

  const home = clubs.find((club) => String(club.id) === homeId);
  const away = clubs.find((club) => String(club.id) === awayId);
  const sameClub = Boolean(home && away && home.id === away.id);
  const notEnoughClubs = clubs.length < 2;

  function clearErrors() {
    setApiError("");
    setErrorSide(null);
    setNetworkError(false);
  }

  async function submit() {
    clearErrors();
    if (!home || !away || sameClub) return;

    setSubmitting(true);
    try {
      const [match] = await Promise.all([
        matchesService.create(home.id, away.id),
        wait(MIN_PLAYING_MS),
      ]);
      onPlayed(match);
    } catch (err) {
      if (err instanceof TypeError) {
        setNetworkError(true);
      } else {
        const message = err instanceof Error ? err.message : "Não foi possível jogar a partida.";
        if (/mandante/i.test(message) && /escala/i.test(message)) {
          setErrorSide("home");
          setApiError(await explainLineup(home.id, home.name, message));
        } else if (/visitante/i.test(message) && /escala/i.test(message)) {
          setErrorSide("away");
          setApiError(await explainLineup(away.id, away.name, message));
        } else {
          setApiError(message);
        }
      }
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Nova partida"
      description="Escolha o mandante e o visitante. O placar sai dos atributos dos titulares, sem sorteio."
      onClose={onClose}
      busy={submitting}
      width={520}
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
              <p>A partida não foi registrada. Verifique a conexão e tente de novo.</p>
            </div>
          </div>
        )}

        {apiError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          >
            <CircleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <div className="text-[13px] leading-5">
              <p className="font-medium text-red-800">Não foi possível jogar a partida</p>
              <p>{apiError}</p>
            </div>
          </div>
        )}

        <ClubSelect
          id="match-home"
          label="Mandante"
          hint="Faz os 3 primeiros ataques."
          value={homeId}
          clubs={clubs}
          invalid={errorSide === "home"}
          disabled={submitting}
          onChange={(value) => {
            setHomeId(value);
            clearErrors();
          }}
        />

        <ClubSelect
          id="match-away"
          label="Visitante"
          hint="Precisa ser um clube diferente do mandante."
          error={sameClub ? "Precisa ser um clube diferente do mandante." : undefined}
          value={awayId}
          clubs={clubs}
          invalid={errorSide === "away" || sameClub}
          disabled={submitting}
          onChange={(value) => {
            setAwayId(value);
            clearErrors();
          }}
        />

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5">
          <p className="flex items-center gap-2 text-[13px] font-medium">
            <Info size={14} strokeWidth={1.7} className="text-neutral-600" />
            Como sai o placar
          </p>
          <p className="mt-2 text-[12px] leading-[18px] text-neutral-600">
            Cada time faz 3 ataques. Pela ordem do elenco, os jogadores de linha vão do 1º (o mais
            recuado) ao 4º (o mais avançado): o 4º enfrenta o goleiro, o 3º enfrenta o 1º e o 2º
            enfrenta o 2º do adversário. O atacante usa finalização (ATA), passe (MEI) ou drible
            (ZAG e LAT), e quem defende usa defesa. É gol só quando o ataque é maior; mal
            condicionado joga com 15% a menos.
          </p>
          <p className="mt-2 text-[12px] leading-[18px] text-neutral-600">
            Os dois clubes precisam ter os 5 titulares escalados. A partida não mexe no caixa.
          </p>
        </div>

        {notEnoughClubs && (
          <p role="alert" className="text-[12px] text-red-600">
            A liga precisa de pelo menos 2 clubes para jogar uma partida.
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-neutral-200" />
      <ModalActions>
        <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || notEnoughClubs || !home || !away || sameClub}
          aria-busy={submitting}
          className={`${btnPrimary} min-w-[150px] justify-center transition-opacity ${
            submitting ? "cursor-wait opacity-70" : ""
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : networkError ? (
            <RefreshCw size={14} strokeWidth={1.8} />
          ) : (
            <Swords size={14} strokeWidth={1.8} />
          )}
          {submitting ? "Jogando…" : networkError ? "Tentar de novo" : "Jogar partida"}
        </button>
      </ModalActions>
    </Modal>
  );
}

function ClubSelect({
  id,
  label,
  hint,
  error,
  value,
  clubs,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  value: string;
  clubs: Clube[];
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <Shield
          size={14}
          strokeWidth={1.7}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
        />
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={invalid}
          className={`${inputClass} appearance-none pl-9 pr-9 ${invalid ? invalidClass : ""}`}
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name} ({club.acronym})
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
        />
      </div>
      <p className={`mt-1.5 text-[11px] leading-4 ${error ? "text-red-600" : "text-neutral-500"}`}>
        {error ?? hint}
      </p>
    </div>
  );
}
