"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleCheck,
  ChevronDown,
  CircleAlert,
  Loader2,
  Lock,
  Swords,
  TriangleAlert,
} from "lucide-react";
import { Avatar, initialsOf } from "@/src/components/players/Avatar";
import {
  clubsService,
  type EscalacaoAtual,
  type JogadorDoClube,
} from "@/src/services/clubs";
import { POSICOES } from "@/src/services/players";
import type { Condicao, Formacao, Posicao } from "@/src/types";

/* ------------------------------ Regras de vaga ----------------------------- */

type Line = "gk" | "def" | "mid" | "att";

interface Slot {
  line: Line;
  label: string;
  hint: string;
  positions: Posicao[];
}

const GK: Slot = {
  line: "gk",
  label: "Goleiro",
  hint: "GOL",
  positions: ["GOL"],
};
const DEF: Slot = {
  line: "def",
  label: "Defesa",
  hint: "ZAG ou LAT",
  positions: ["ZAG", "LAT"],
};
const MID: Slot = {
  line: "mid",
  label: "Meio",
  hint: "MEI",
  positions: ["MEI"],
};
const ATT: Slot = {
  line: "att",
  label: "Ataque",
  hint: "ATA",
  positions: ["ATA"],
};

/** Vagas de cada formação, do goleiro ao ataque (a ordem é a enviada à API). */
const FORMATIONS: Record<Formacao, { description: string; slots: Slot[] }> = {
  "3-1": { description: "Defesa 3, ataque 1", slots: [GK, DEF, DEF, DEF, ATT] },
  "2-2": { description: "Defesa 2, ataque 2", slots: [GK, DEF, DEF, ATT, ATT] },
  "2-1-1": {
    description: "Defesa 2, meio 1, ataque 1",
    slots: [GK, DEF, DEF, MID, ATT],
  },
  "1-2-1": {
    description: "Defesa 1, meio 2, ataque 1",
    slots: [GK, DEF, MID, MID, ATT],
  },
};

const FORMATION_ORDER: Formacao[] = ["3-1", "2-2", "2-1-1", "1-2-1"];
const DEFAULT_FORMATION: Formacao = "2-1-1";

/** Atributos que contam para cada posição. */
const ATTRIBUTES: Record<
  Posicao,
  { label: string; key: keyof JogadorDoClube }[]
> = {
  GOL: [{ label: "Defesa", key: "defending" }],
  ZAG: [{ label: "Defesa", key: "defending" }],
  LAT: [
    { label: "Drible", key: "dribbling" },
    { label: "Defesa", key: "defending" },
  ],
  MEI: [{ label: "Passe", key: "passing" }],
  ATA: [{ label: "Finalização", key: "shooting" }],
};

const CONDITIONS: Record<
  Condicao,
  { label: string; className: string; dot: string }
> = {
  APTO: {
    label: "Apto",
    className: "border-green-200 bg-green-50 text-green-700",
    dot: "bg-green-500",
  },
  MAL_CONDICIONADO: {
    label: "Mal condicionado",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  DOENTE: {
    label: "Doente",
    className: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

type Assignment = (number | null)[];

interface Draft {
  formation: Formacao;
  assignment: Assignment;
}

const eligible = (player: JogadorDoClube, slot: Slot) =>
  slot.positions.includes(player.position);

/** Distribui os titulares recebidos nas vagas, na ordem, respeitando a posição. */
function assignStarters(
  formation: Formacao,
  starterIds: number[],
  players: JogadorDoClube[],
): Assignment {
  const used = new Set<number>();
  return FORMATIONS[formation].slots.map((slot) => {
    const found = starterIds
      .map((id) => players.find((player) => player.id === id))
      .find(
        (player) => player && !used.has(player.id) && eligible(player, slot),
      );
    if (!found) return null;
    used.add(found.id);
    return found.id;
  });
}

/** Ao trocar de formação, mantém quem ainda cabe em alguma vaga. */
function remap(
  from: Assignment,
  nextFormation: Formacao,
  players: JogadorDoClube[],
): Assignment {
  return assignStarters(
    nextFormation,
    from.filter((id): id is number => id !== null),
    players,
  );
}

/* ------------------- Aviso de titular vendido (lembrado no navegador) ------------------- */

const soldKey = (clubId: number) => `passe:titular-vendido:${clubId}`;

/**
 * Chamado pela tela do clube quando um TITULAR é vendido. A API mantém a formação e os
 * titulares que sobraram, mas não guarda quem saiu; por isso o nome fica aqui, até a
 * escalação ser completada de novo.
 */
export function rememberSoldStarter(clubId: number, playerName: string) {
  try {
    localStorage.setItem(soldKey(clubId), JSON.stringify({ name: playerName }));
  } catch {
    // Aviso opcional: sem armazenamento, a aba mostra a mensagem genérica.
  }
}

function readSoldStarter(clubId: number): string | null {
  try {
    const raw = localStorage.getItem(soldKey(clubId));
    const parsed = raw ? (JSON.parse(raw) as { name?: unknown }) : null;
    return typeof parsed?.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}

function clearSoldStarter(clubId: number) {
  try {
    localStorage.removeItem(soldKey(clubId));
  } catch {
    // ignora
  }
}

/** Com estes jogadores (sem os doentes) dá para fechar pelo menos uma formação? */
function canCloseSomeFormation(available: JogadorDoClube[]) {
  const count = (positions: Posicao[]) =>
    available.filter((p) => positions.includes(p.position)).length;
  const have = {
    gk: count(["GOL"]),
    def: count(["ZAG", "LAT"]),
    mid: count(["MEI"]),
    att: count(["ATA"]),
  };
  return FORMATION_ORDER.some((formation) => {
    const need = (line: Line) =>
      FORMATIONS[formation].slots.filter((slot) => slot.line === line).length;
    return (
      have.gk >= need("gk") &&
      have.def >= need("def") &&
      have.mid >= need("mid") &&
      have.att >= need("att")
    );
  });
}

const shortName = (name: string) =>
  name.trim().split(/\s+/).slice(-1)[0] ?? name;

/* --------------------------------- Aba ------------------------------------ */

export function LineupTab({
  clubId,
  clubName,
  players,
  onSaved,
  onRefused,
}: {
  clubId: number;
  clubName: string;
  players: JogadorDoClube[];
  /** Chamado depois de salvar, para atualizar a tela e avisar o usuário. */
  onSaved: () => void;
  /** Chamado quando a API recusa a escalação: recarrega elenco e escalação. */
  onRefused: () => void;
}) {
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFormation, setSavedFormation] = useState<Formacao | null>(null);
  const [soldStarter, setSoldStarter] = useState<string | null>(null);

  // Carrega a escalação atual ao abrir a aba (e quando o elenco muda).
  useEffect(() => {
    let cancelled = false;
    clubsService
      .getLineup(clubId)
      .catch((err: unknown): EscalacaoAtual => {
        if (!cancelled)
          setLoadError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar a escalação atual.",
          );
        return { formation: null, starterIds: [] };
      })
      .then((lineup) => {
        if (cancelled) return;
        const formation = lineup.formation ?? DEFAULT_FORMATION;
        const initial: Draft = {
          formation,
          assignment: assignStarters(formation, lineup.starterIds, players),
        };
        const complete =
          lineup.formation !== null &&
          initial.assignment.every((id) => id !== null);
        if (complete) clearSoldStarter(clubId);
        setSavedFormation(lineup.formation);
        setSoldStarter(complete ? null : readSoldStarter(clubId));
        setSaved(initial);
        setDraft(initial);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, players]);

  const byId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  if (!draft || !saved) return <LineupSkeleton />;

  const { slots } = FORMATIONS[draft.formation];
  const starters = draft.assignment.map((id) =>
    id === null ? null : (byId.get(id) ?? null),
  );
  const filled = starters.filter(Boolean).length;
  const complete = filled === slots.length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  // O aviso reflete a escalação salva (a que a API usa para liberar partidas).
  const savedFilled = saved.assignment.filter((id) => id !== null).length;
  const savedComplete = savedFilled === slots.length;
  const squadSize = players.length;
  // Considera todo o elenco (titulares e reservas): quem está mal condicionado perde 15% se jogar.
  const weak = players.filter((p) => p.condition === "MAL_CONDICIONADO");
  const reserves = players.filter(
    (player) => !draft.assignment.includes(player.id),
  );
  // Doentes do elenco: não podem ser escalados. A caixa vermelha aparece sempre que houver algum
  // (e, depois de uma recusa da API, mostra a mensagem dela).
  const sick = players.filter((p) => p.condition === "DOENTE");
  const sickNames = joinNames(sick.map((p) => p.name));
  const sickMessage =
    sick.length === 1
      ? `${sickNames} está DOENTE e não pode ser escalado.`
      : `${sickNames} estão DOENTES e não podem ser escalados.`;
  const refusal = saveError !== "";

  // Aviso de escalação incompleta com elenco suficiente (ex.: titular vendido ou doente).
  const available = players.filter((p) => p.condition !== "DOENTE");
  const lineAvailable = available.filter((p) => p.position !== "GOL").length;
  const closable = canCloseSomeFormation(available);
  const incompleteLead =
    soldStarter && savedFormation
      ? `${soldStarter} foi vendido e saiu da escalação: a ${savedFormation} continua salva, com ${savedFilled} ${savedFilled === 1 ? "titular" : "titulares"}.`
      : `A escalação salva tem ${savedFilled} de ${slots.length} titulares: 1 goleiro e ${slots.length - 1} jogadores de linha.`;
  const incompleteTail = closable
    ? "Escolha os titulares abaixo e salve a escalação."
    : sick.length > 0
      ? `Com ${sick.length === 1 ? "o " : ""}${sickNames} ${sick.length === 1 ? "DOENTE" : "DOENTES"}, ${
          lineAvailable === 1
            ? "sobra 1 jogador de linha que pode ser escalado"
            : `sobram ${lineAvailable} jogadores de linha que podem ser escalados`
        }, e nenhuma formação fecha: o clube precisa comprar um jogador e escalar de novo.`
      : "Os jogadores disponíveis não fecham nenhuma formação: o clube precisa comprar um jogador e escalar de novo.";
  // A caixa amarela já explica o doente nesse caso; a vermelha fica para recusas da API.
  const amberExplainsSick = !savedComplete && squadSize >= slots.length;

  function chooseFormation(formation: Formacao) {
    if (!draft || formation === draft.formation) return;
    setSaveError("");
    setDraft({
      formation,
      assignment: remap(draft.assignment, formation, players),
    });
  }

  function choosePlayer(index: number, value: string) {
    if (!draft) return;
    setSaveError("");
    const next = [...draft.assignment];
    next[index] = value ? Number(value) : null;
    setDraft({ ...draft, assignment: next });
  }

  async function save() {
    if (!draft || !complete) return;
    setSaving(true);
    setSaveError("");
    try {
      await clubsService.saveLineup(
        clubId,
        draft.formation,
        draft.assignment as number[],
      );
      clearSoldStarter(clubId);
      setSoldStarter(null);
      setSavedFormation(draft.formation);
      setSaved(draft);
      onSaved();
    } catch (err) {
      const apiMessage =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar a escalação.";
      // Se alguém ficou doente depois de a tela abrir, diz quem (a API só diz "Jogadores DOENTE…").
      let message = apiMessage;
      if (/doente/i.test(apiMessage)) {
        const fresh = await clubsService.get(clubId).catch(() => null);
        const sick = (fresh?.players ?? []).filter(
          (player) =>
            draft.assignment.includes(player.id) &&
            player.condition === "DOENTE",
        );
        if (sick.length > 0) {
          const names = joinNames(sick.map((player) => player.name));
          message =
            sick.length === 1
              ? `${names} está DOENTE e não pode ser escalado.`
              : `${names} estão DOENTES e não podem ser escalados.`;
        }
      }
      setSaveError(message);
      onRefused(); // recarrega elenco e escalação; a escalação salva continua valendo
    } finally {
      setSaving(false);
    }
  }

  const noLineup = !savedComplete && savedFilled === 0;
  const incompleteAlert = (margin: string) => (
    <div
      role="alert"
      className={`${margin} flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800`}
    >
      <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
      <div className="text-[13px] leading-5">
        <p className="font-medium text-amber-900">
          Escalação incompleta: o {clubName} não pode jogar partidas
        </p>
        <p>
          {squadSize < slots.length
            ? `O elenco tem ${squadSize} ${squadSize === 1 ? "jogador" : "jogadores"}, e a escalação precisa de ${slots.length}: 1 goleiro e ${slots.length - 1} jogadores de linha. Compre jogadores e salve a escalação com os ${slots.length} titulares.`
            : `${incompleteLead} ${incompleteTail}`}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {noLineup && incompleteAlert("mb-4")}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
            <div>
              <h2 className="text-[15px] font-semibold">Titulares</h2>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                1 goleiro e 4 jogadores de linha, na formação escolhida. Salvar
                troca os 5 de uma vez.
              </p>
            </div>
            {complete ? (
              <span className="flex shrink-0 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                <CircleCheck size={11} strokeWidth={2.2} />
                Completa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <TriangleAlert
                  size={16}
                  strokeWidth={1.8}
                  className="shrink-0"
                />
                Incompleta
              </span>
            )}
          </div>

          {!savedComplete && !noLineup && incompleteAlert("mx-4 mb-4")}

          {loadError && (
            <p
              role="alert"
              className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
            >
              <CircleAlert size={14} className="mt-0.5 shrink-0" />
              {loadError} Você ainda pode montar uma escalação nova.
            </p>
          )}

          {(refusal || (sick.length > 0 && !amberExplainsSick)) && (
            <div
              role="alert"
              className="mx-4 mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
            >
              <CircleAlert
                size={16}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0"
              />
              <div className="text-[13px] leading-5">
                <p className="font-medium text-red-800">
                  {refusal
                    ? "A escalação foi recusada"
                    : "Jogador doente não pode ser escalado"}
                </p>
                <p>{refusal ? saveError : sickMessage}</p>
              </div>
            </div>
          )}

          {/* Formação */}
          <div className="border-t border-neutral-200 px-4 py-4">
            <p className="text-[13px] font-medium">Formação</p>
            <p className="mt-0.5 text-[12px] text-neutral-500">
              Os números contam os jogadores de linha de trás para frente. O
              goleiro fica fora da conta.
            </p>
            <div
              role="radiogroup"
              aria-label="Formação"
              className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
            >
              {FORMATION_ORDER.map((formation) => {
                const selected = draft.formation === formation;
                return (
                  <button
                    key={formation}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseFormation(formation)}
                    className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                      selected
                        ? "border-[#155DFC] bg-[#155DFC]/5"
                        : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <MiniField slots={FORMATIONS[formation].slots} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                        <span
                          aria-hidden
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                            selected ? "border-[#155DFC]" : "border-neutral-400"
                          }`}
                        >
                          {selected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#155DFC]" />
                          )}
                        </span>
                        {formation}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">
                        {FORMATIONS[formation].description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vagas */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-neutral-50 text-[12px] text-neutral-500">
                  <th scope="col" className="px-4 py-2.5 text-left font-normal">
                    Vaga
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">
                    Titular
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">
                    Condição
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-normal"
                  >
                    Overall
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-normal">
                    Atributos usados
                  </th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, index) => {
                  const player = starters[index];
                  const condition = player
                    ? CONDITIONS[player.condition]
                    : null;
                  const takenElsewhere = new Set(
                    draft.assignment.filter(
                      (id, i) => i !== index && id !== null,
                    ),
                  );
                  const options = players
                    .filter(
                      (p) => eligible(p, slot) && !takenElsewhere.has(p.id),
                    )
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
                  // Ninguém que possa ocupar a vaga (todos já escalados, doentes ou de outra posição).
                  const noOneAvailable =
                    !player &&
                    options.every((option) => option.condition === "DOENTE");

                  return (
                    <tr key={index} className="border-t border-neutral-200">
                      <td className="px-4 py-3">
                        <p className="font-medium">{slot.label}</p>
                        <p className="text-[11px] text-neutral-500">
                          {slot.hint}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative w-[230px]">
                          <select
                            value={player?.id ?? ""}
                            onChange={(event) =>
                              choosePlayer(index, event.target.value)
                            }
                            disabled={noOneAvailable}
                            aria-label={`Titular da vaga ${slot.label} ${index + 1}`}
                            className="h-9 w-full appearance-none rounded-lg border border-neutral-300 bg-white pl-3 pr-8 text-[13px] outline-none transition focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/15 disabled:bg-neutral-50 disabled:text-neutral-400"
                          >
                            <option value="">
                              {noOneAvailable
                                ? `Sem ${slot.hint}`
                                : "Escolher jogador"}
                            </option>
                            {options.map((option) => (
                              <option
                                key={option.id}
                                value={option.id}
                                disabled={option.condition === "DOENTE"}
                              >
                                {option.name} ({option.position})
                                {option.condition === "DOENTE"
                                  ? " · Doente"
                                  : ""}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {condition ? (
                          <span
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${condition.className}`}
                          >
                            <span aria-hidden className="text-[8px]">
                              ●
                            </span>
                            {condition.label}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {player?.overall ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {player ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {ATTRIBUTES[player.position].map(
                              ({ label, key }) => (
                                <span
                                  key={label}
                                  className="whitespace-nowrap text-neutral-600"
                                >
                                  {label}{" "}
                                  <b className="font-semibold text-neutral-950 tabular-nums">
                                    {String(player[key])}
                                  </b>
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {weak.length > 0 && (
            <div
              role="status"
              className="mx-4 mb-3 mt-1 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-800"
            >
              <TriangleAlert
                size={15}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0"
              />
              <div className="text-[12px] leading-4">
                <p className="font-semibold">
                  {joinNames(weak.map((p) => p.name))}{" "}
                  {weak.length === 1
                    ? "está mal condicionado"
                    : "estão mal condicionados"}
                </p>
                <p className="mt-0.5">
                  {weak.length === 1 ? "Pode jogar" : "Podem jogar"}, mas cada
                  atributo vale 15% a menos durante a partida.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3">
            <p className="max-w-[420px] text-[11px] leading-4 text-neutral-500">
              A escalação vale até ser trocada. Titular vendido ou que fica
              doente sai dela, e o clube só volta a jogar depois de escalar de
              novo.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(saved);
                  setSaveError("");
                }}
                disabled={saving || !dirty}
                className="h-9 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-medium shadow-sm transition hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !complete || !dirty}
                className="flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} strokeWidth={2} />
                )}
                Salvar escalação
              </button>
            </div>
          </div>
        </section>

        {/* Coluna lateral */}
        <div className="space-y-4">
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-[15px] font-semibold">Em campo</h2>
            <p className="mt-0.5 text-[12px] text-neutral-500">
              {filled < slots.length
                ? `Prévia da formação ${draft.formation}; a vaga vazia fica tracejada.`
                : `Prévia da formação ${draft.formation}, do goleiro ao ataque.`}
            </p>
            <Pitch slots={slots} starters={starters} />
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[11px] leading-4 text-neutral-600">
              <Swords size={13} strokeWidth={1.7} className="mt-0.5 shrink-0" />
              Na partida, atacam os 3 jogadores de linha mais avançados e
              defendem o goleiro e os 2 mais recuados. É gol quando o ataque é
              maior que a defesa.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="px-4 pb-3 pt-4">
              <h2 className="text-[15px] font-semibold">Reservas</h2>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                Jogadores do elenco fora da escalação.
              </p>
            </div>
            {reserves.length === 0 ? (
              <p className="border-t border-neutral-200 px-4 py-3 text-[12px] text-neutral-500">
                Todos os jogadores do elenco estão escalados.
              </p>
            ) : (
              <ul className="max-h-[280px] divide-y divide-neutral-100 overflow-y-auto overscroll-contain border-t border-neutral-200">
                {reserves.map((player) => {
                  const condition = CONDITIONS[player.condition];
                  return (
                    <li
                      key={player.id}
                      className="flex items-center gap-2.5 px-4 py-2.5"
                    >
                      <Avatar id={player.id} name={player.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          {player.name}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {POSICOES[player.position]}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${condition.className}`}
                      >
                        <span aria-hidden className="text-[8px]">
                          ●
                        </span>
                        {condition.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {reserves.some((player) => player.condition === "DOENTE") && (
              <p className="mx-4 mb-4 mt-1 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] text-neutral-600">
                <Lock size={12} strokeWidth={1.7} className="shrink-0" />
                Doente não pode ser escalado.
              </p>
            )}
          </section>
        </div>

        <p className="text-[11px] leading-4 text-neutral-500 lg:col-span-2">
          Escalação na formação {draft.formation}, com os titulares na ordem do
          elenco. Salvar troca a formação e os 5 titulares de uma vez; titular
          doente, fora do elenco ou posições que não fecham a formação são
          recusados (RN19).
        </p>
      </div>
    </>
  );
}

/* ------------------------------- Auxiliares -------------------------------- */

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Linhas do campo, do ataque (topo) ao goleiro (base). */
function rowsOf<T>(slots: Slot[], items: T[]) {
  const order: Line[] = ["att", "mid", "def", "gk"];
  return order
    .map((line) => ({
      line,
      items: items.filter((_, index) => slots[index].line === line),
    }))
    .filter((row) => row.items.length > 0);
}

function MiniField({ slots }: { slots: Slot[] }) {
  const rows = rowsOf(slots, slots);
  const ys: Record<Line, number> = { att: 9, mid: 18, def: 27, gk: 34 };
  return (
    <svg
      width="30"
      height="40"
      viewBox="0 0 30 40"
      aria-hidden
      className="shrink-0 rounded-md"
    >
      <rect width="30" height="40" rx="4" fill="#1f6b3a" />
      <rect
        x="2"
        y="2"
        width="26"
        height="36"
        rx="2"
        fill="none"
        stroke="#ffffff55"
        strokeWidth="0.8"
      />
      <line
        x1="2"
        y1="20"
        x2="28"
        y2="20"
        stroke="#ffffff55"
        strokeWidth="0.8"
      />
      {rows.flatMap((row) =>
        row.items.map((_, i) => (
          <circle
            key={`${row.line}-${i}`}
            cx={(30 / (row.items.length + 1)) * (i + 1)}
            cy={ys[row.line]}
            r="2.2"
            fill="#fff"
          />
        )),
      )}
    </svg>
  );
}

function Pitch({
  slots,
  starters,
}: {
  slots: Slot[];
  starters: (JogadorDoClube | null)[];
}) {
  const order: Line[] = ["att", "mid", "def", "gk"];
  const entries = slots.map((slot, index) => ({
    slot,
    player: starters[index],
  }));
  const rows = order
    .map((line) => ({
      line,
      entries: entries.filter((entry) => entry.slot.line === line),
    }))
    .filter((row) => row.entries.length > 0);
  return (
    <div
      className="relative mt-3 flex aspect-[4/4.4] flex-col justify-between overflow-hidden rounded-lg px-2 py-4"
      style={{
        background:
          "repeating-linear-gradient(180deg, #1f6b3a 0 12.5%, #1a5c32 12.5% 25%)",
      }}
    >
      {/* Marcações */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-sm border border-white/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-white/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[28%] bottom-2 h-[18%] border border-b-0 border-white/40"
      />

      {rows.map((row) => (
        <div
          key={row.line}
          className="relative flex items-start justify-around"
        >
          {row.entries.map(({ slot, player }, index) => (
            <div
              key={player?.id ?? `${row.line}-${index}`}
              className="flex w-[72px] flex-col items-center gap-0.5"
            >
              <span
                className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold ${
                  player
                    ? "border-white bg-[#155DFC] text-white"
                    : "border-dashed border-white/60 bg-white/10 text-white/80"
                }`}
              >
                {player ? initialsOf(player.name) : "+"}
                {player?.condition === "MAL_CONDICIONADO" && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500"
                  />
                )}
              </span>
              <span className="max-w-full truncate rounded bg-black/55 px-1.5 text-[10px] leading-4 text-white">
                {player ? shortName(player.name) : slot.label}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function LineupSkeleton() {
  return (
    <div
      aria-hidden
      className="grid animate-pulse gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="h-[560px] rounded-xl bg-neutral-100" />
      <div className="space-y-4">
        <div className="h-[340px] rounded-xl bg-neutral-100" />
        <div className="h-[140px] rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
}