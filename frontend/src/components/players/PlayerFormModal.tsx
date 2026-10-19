"use client";

import { useState } from "react";
import { BarChart3, CircleAlert, Info, Loader2, Lock, UserRound } from "lucide-react";
import {
  Modal,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/src/components/Modal";
import { POSICOES, playersService, type DadosJogador } from "@/src/services/players";
import { formatMoney } from "@/src/utils/format";
import type { Jogador, Posicao } from "@/src/types";

type Form = Record<keyof DadosJogador, string>;

const ATTRIBUTES: { key: keyof DadosJogador; label: string }[] = [
  { key: "pace", label: "Velocidade" },
  { key: "shooting", label: "Finalização" },
  { key: "passing", label: "Passe" },
  { key: "dribbling", label: "Drible" },
  { key: "defending", label: "Defesa" },
  { key: "physical", label: "Físico" },
];

const EMPTY: Form = {
  name: "", position: "", age: "", agility: "",
  pace: "", shooting: "", passing: "", dribbling: "",
  defending: "", physical: "", potential: "",
};

function fromPlayer(player: Jogador): Form {
  return {
    name: player.name,
    position: player.position,
    age: String(player.age),
    agility: String(player.agility),
    pace: String(player.pace),
    shooting: String(player.shooting),
    passing: String(player.passing),
    dribbling: String(player.dribbling),
    defending: String(player.defending),
    physical: String(player.physical),
    potential: String(player.potential),
  };
}

function intIn(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

/** Espelha as regras do backend (players.service.ts e DTOs). */
function validate(form: Form, creating: boolean): Partial<Record<keyof DadosJogador | "form", string>> {
  const errors: Partial<Record<keyof DadosJogador | "form", string>> = {};
  const name = form.name.trim().replace(/\s+/g, " ");

  if (name.length < 3 || name.length > 100) errors.name = "De 3 a 100 caracteres.";
  else if (/\d/.test(name)) errors.name = "O nome não pode ter números.";
  else if (name.split(" ").length < 2) errors.name = "Use pelo menos duas palavras.";

  if (!form.position) errors.position = "Escolha a posição.";

  const age = intIn(form.age, 16, 45);
  if (age === null) errors.age = "De 16 a 45 anos.";

  const agility = intIn(form.agility, 1, 100);
  if (agility === null) errors.agility = "De 1 a 100.";
  else if (age !== null && age >= 35 && agility > 85) errors.agility = "Até 85 com 35 anos ou mais.";

  if (!creating) return errors;

  const values: number[] = [];
  for (const { key } of ATTRIBUTES) {
    const n = intIn(form[key], 1, 99);
    if (n === null) errors[key] = "De 1 a 99.";
    else values.push(n);
  }
  const potential = intIn(form.potential, 1, 99);
  if (potential === null) errors.potential = "De 1 a 99.";

  if (values.length === ATTRIBUTES.length) {
    const max = Math.max(...values);
    if (values.reduce((sum, v) => sum + v, 0) > 480)
      errors.form = "A soma dos atributos não pode ultrapassar 480.";
    else if (potential !== null && potential < max)
      errors.potential = "Deve ser maior ou igual ao maior atributo.";
    else if (potential !== null && age !== null && age >= 33 && potential !== max)
      errors.potential = "Com 33 anos ou mais, deve ser igual ao maior atributo.";
  }
  return errors;
}

export function PlayerFormModal({
  player,
  onClose,
  onSaved,
}: {
  /** Sem jogador: cadastro. Com jogador: edição. */
  player?: Jogador;
  onClose: () => void;
  onSaved: (saved: Jogador, created: boolean) => void;
}) {
  const creating = !player;
  const [form, setForm] = useState<Form>(player ? fromPlayer(player) : EMPTY);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasClub = !!player && player.club_id !== null;

  function set(key: keyof DadosJogador, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined, form: undefined }));
  }

  async function submit() {
    const found = validate(form, creating);
    if (Object.values(found).some(Boolean)) return setErrors(found);

    const body: DadosJogador = {
      name: form.name.trim().replace(/\s+/g, " "),
      position: form.position as Posicao,
      age: Number(form.age),
      agility: Number(form.agility),
      pace: Number(form.pace),
      shooting: Number(form.shooting),
      passing: Number(form.passing),
      dribbling: Number(form.dribbling),
      defending: Number(form.defending),
      physical: Number(form.physical),
      potential: Number(form.potential),
    };

    setSubmitting(true);
    setServerError("");
    try {
      const saved = creating
        ? await playersService.create(body)
        : await playersService.update(player.id, body);
      onSaved(saved, creating);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Não foi possível salvar o jogador.");
      setSubmitting(false);
    }
  }

  const potential = intIn(form.potential, 1, 99);

  return (
    <Modal
      title={creating ? "Novo jogador" : "Editar jogador"}
      description={
        creating
          ? "Preencha os dados e os indicadores técnicos. O valor base, o overall e o valor de mercado são calculados ao salvar."
          : "Edite nome, posição, idade e agilidade. Os demais dados não mudam."
      }
      onClose={onClose}
      busy={submitting}
      width={760}
    >
      <div className="space-y-4">
        <Field label="Nome" error={errors.name} hint="De 3 a 100 caracteres, com pelo menos duas palavras e sem números.">
          <div className="relative">
            <UserRound size={14} strokeWidth={1.7} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={100}
              autoFocus
              className={`${inputClass} pl-8`}
            />
          </div>
        </Field>

        <div>
          <p className="text-[12px] font-medium">Posição</p>
          <div role="radiogroup" aria-label="Posição" className="mt-1 grid grid-cols-5 gap-2">
            {(Object.keys(POSICOES) as Posicao[]).map((key) => {
              const selected = form.position === key;
              const disabled = hasClub && key !== player?.position;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => set("position", key)}
                  className={`rounded-lg border px-1 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-[#155DFC] bg-[#155DFC]/5 text-[#155DFC]"
                      : "border-neutral-300 bg-white hover:bg-neutral-50"
                  }`}
                >
                  <span className="block text-[13px] font-semibold">{key}</span>
                  <span className={`block text-[11px] ${selected ? "" : "text-neutral-500"}`}>{POSICOES[key]}</span>
                </button>
              );
            })}
          </div>
          {errors.position ? (
            <p className="mt-1 text-[11px] text-red-600">{errors.position}</p>
          ) : hasClub ? (
            <p className="mt-1 text-[11px] text-neutral-500">Jogador com clube não muda de posição.</p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Idade" error={errors.age} hint="De 16 a 45 anos.">
            <input inputMode="numeric" value={form.age} onChange={(e) => set("age", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Agilidade" error={errors.agility} hint="De 1 a 100 (até 85 com 35 anos ou mais).">
            <input inputMode="numeric" value={form.agility} onChange={(e) => set("agility", e.target.value)} className={inputClass} />
          </Field>
          {creating ? (
            <Field label="Valor base (moedas)" hint="Calculado no cadastro.">
              <Locked />
            </Field>
          ) : (
            <Field label="Valor base (moedas)" hint="Recalculado ao salvar.">
              <Locked text={formatMoney(player.base_value)} />
            </Field>
          )}
        </div>

        {creating && (
          <div className="border-t border-neutral-200 pt-4">
            <h3 className="text-[14px] font-semibold">Indicadores técnicos</h3>
            <p className="mt-0.5 text-[12px] text-neutral-500">
              Seis atributos e o potencial, de 1 a 99. Não mudam depois do cadastro; a soma dos seis
              atributos não pode passar de 480.
            </p>

            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_250px]">
              <div className="grid grid-cols-2 content-start gap-x-3 gap-y-3 sm:grid-cols-4">
                {ATTRIBUTES.map(({ key, label }) => (
                  <Field key={key} label={label} error={errors[key]}>
                    <input inputMode="numeric" value={form[key]} onChange={(e) => set(key, e.target.value)} className={inputClass} />
                  </Field>
                ))}
                <Field label="Potencial" error={errors.potential} hint="≥ maior atributo; igual a ele com 33+ anos">
                  <input inputMode="numeric" value={form.potential} onChange={(e) => set("potential", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Overall" hint="Calculado automaticamente">
                  <Locked />
                </Field>
              </div>

              <AttributePreview form={form} potential={potential} />
            </div>
          </div>
        )}
      </div>

      {(errors.form || serverError) && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <CircleAlert size={14} className="mt-0.5 shrink-0" />
          {errors.form || serverError}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <p className="flex items-center gap-1.5 text-[12px] text-neutral-500">
          <Info size={13} strokeWidth={1.7} />
          {creating ? "O jogador começa livre e Apto." : "Valor base, overall e valor de mercado são recalculados ao salvar."}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={submitting} className={btnPrimary}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {creating ? "Salvar jogador" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Campo bloqueado, preenchido pela API depois de salvar. */
function Locked({ text = "Após salvar" }: { text?: string }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 text-[13px] text-neutral-500">
      <Lock size={13} strokeWidth={1.7} />
      {text}
    </div>
  );
}

/** Prévia só dos valores digitados: não calcula overall nem valor base. */
function AttributePreview({ form, potential }: { form: Form; potential: number | null }) {
  return (
    <aside className="rounded-lg border border-neutral-200 bg-neutral-50 p-3" aria-label="Prévia dos atributos">
      <p className="flex items-center gap-1.5 text-[12px] text-neutral-600">
        <BarChart3 size={13} strokeWidth={1.7} />
        Prévia dos atributos
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {ATTRIBUTES.map(({ key, label }) => {
          const value = intIn(form[key], 1, 99);
          return (
            <li key={key} className="flex items-center gap-2 text-[11px]">
              <span className="w-[68px] shrink-0 text-neutral-600">{label}</span>
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200/70">
                {potential !== null && (
                  <span className="absolute inset-y-0 left-0 rounded-full bg-[#155DFC]/20" style={{ width: `${potential}%` }} />
                )}
                {value !== null && (
                  <span className="absolute inset-y-0 left-0 rounded-full bg-[#155DFC]" style={{ width: `${value}%` }} />
                )}
              </span>
              <span className="w-5 text-right font-medium tabular-nums">{value ?? "–"}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-4 text-neutral-500">
        Faixa clara: até o potencial{potential !== null ? ` (${potential})` : ""}. A prévia só desenha os
        valores digitados; não calcula overall nem valor base.
      </p>
    </aside>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[12px] font-medium">
      {label}
      <div className="mt-1">{children}</div>
      {error ? (
        <span className="mt-1 block text-[11px] font-normal leading-4 text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] font-normal leading-4 text-neutral-500">{hint}</span>
      ) : null}
    </label>
  );
}
