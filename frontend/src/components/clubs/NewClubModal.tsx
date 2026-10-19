"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleAlert, Loader2, Shield, Wallet, X } from "lucide-react";
import { CAIXA_INICIAL, clubsService } from "@/src/services/clubs";
import {
  nameKey,
  normalizeName,
  validateClubForm,
  type ClubField,
} from "@/src/utils/club-validation";
import { formatMoney } from "@/src/utils/format";
import type { Clube } from "@/src/types";

interface NewClubModalProps {
  /** Clubes já cadastrados, usados para checar duplicidade antes de enviar. */
  clubs: Clube[];
  onClose: () => void;
  onCreated: (club: Clube) => void;
}

interface FormError {
  field?: ClubField;
  message: string;
}

const ERROR_TITLE = "Não foi possível criar o clube";

/** Converte a mensagem do backend em um erro associado ao campo certo. */
function mapServerError(message: string, name: string, acronym: string): FormError {
  if (/name já está cadastrado/i.test(message)) {
    return {
      field: "name",
      message: `Já existe um clube com o nome "${normalizeName(name)}".`,
    };
  }
  if (/acronym já está cadastrado/i.test(message)) {
    return {
      field: "acronym",
      message: `Já existe um clube com a sigla "${acronym}".`,
    };
  }
  if (/acronym/i.test(message)) return { field: "acronym", message };
  if (/\bname\b/i.test(message)) return { field: "name", message };
  return { message };
}

export function NewClubModal({ clubs, onClose, onCreated }: NewClubModalProps) {
  const [name, setName] = useState("");
  const [acronym, setAcronym] = useState("");
  const [error, setError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const acronymRef = useRef<HTMLInputElement>(null);

  // Foco inicial e bloqueio de rolagem do fundo enquanto o modal está aberto.
  useEffect(() => {
    nameRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Esc fecha o modal, exceto durante o envio.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  function fail(next: FormError) {
    setError(next);
    (next.field === "acronym" ? acronymRef : nameRef).current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const cleanName = normalizeName(name);

    const validation = validateClubForm(cleanName, acronym);
    if (validation) return fail(validation);

    const sameName = clubs.find((club) => nameKey(club.name) === nameKey(cleanName));
    if (sameName) {
      return fail({
        field: "name",
        message: `Já existe um clube com o nome "${sameName.name}".`,
      });
    }

    const sameAcronym = clubs.find((club) => club.acronym === acronym);
    if (sameAcronym) {
      return fail({
        field: "acronym",
        message: `Já existe um clube com a sigla "${acronym}" (${sameAcronym.name}).`,
      });
    }

    setError(null);
    setSubmitting(true);
    try {
      const created = await clubsService.create({ name: cleanName, acronym });
      onCreated(created);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao processar requisição";
      fail(mapServerError(message, cleanName, acronym));
      setSubmitting(false);
    }
  }

  const nameInvalid = error?.field === "name";
  const acronymInvalid = error?.field === "acronym";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-clube-titulo"
        aria-describedby="novo-clube-descricao"
        className="max-h-full w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="novo-clube-titulo" className="text-[15px] font-semibold">
              Novo clube
            </h2>
            <p
              id="novo-clube-descricao"
              className="mt-1 text-[13px] text-neutral-500"
            >
              Informe o nome e a sigla do clube.
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
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-red-700"
            >
              <CircleAlert size={15} strokeWidth={1.9} className="mt-0.5 shrink-0" />
              <div className="text-[13px] leading-5">
                <p className="font-semibold">{ERROR_TITLE}</p>
                <p>{error.message}</p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="club-name" className="text-[13px] font-medium">
              Nome
            </label>
            <div className="relative mt-1.5">
              <Shield
                size={14}
                strokeWidth={1.7}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
              />
              <input
                ref={nameRef}
                id="club-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameInvalid) setError(null);
                }}
                maxLength={80}
                autoComplete="off"
                aria-invalid={nameInvalid}
                aria-describedby="club-name-help"
                disabled={submitting}
                className={`h-9 w-full rounded-lg border bg-white pl-9 pr-3 text-[13px] outline-none transition disabled:bg-neutral-50 ${
                  nameInvalid
                    ? "border-red-500 focus:ring-2 focus:ring-red-500/15"
                    : "border-neutral-300 focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/15"
                }`}
              />
            </div>
            <p
              id="club-name-help"
              className="mt-1.5 text-[11px] leading-4 text-neutral-500"
            >
              De 3 a 60 caracteres e de 2 a 5 palavras; só letras, espaços,
              hífen e ponto. Não pode repetir outro clube.
            </p>
          </div>

          <div className="mt-4">
            <label htmlFor="club-acronym" className="text-[13px] font-medium">
              Sigla
            </label>
            <input
              ref={acronymRef}
              id="club-acronym"
              value={acronym}
              onChange={(event) => {
                // Só A–Z, sempre maiúsculas, no máximo 3 letras.
                setAcronym(
                  event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3),
                );
                if (acronymInvalid) setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={acronymInvalid}
              aria-describedby="club-acronym-help"
              disabled={submitting}
              className={`mt-1.5 h-9 w-full rounded-lg border bg-white px-3 text-[13px] uppercase outline-none transition disabled:bg-neutral-50 ${
                acronymInvalid
                  ? "border-red-500 focus:ring-2 focus:ring-red-500/15"
                  : "border-neutral-300 focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/15"
              }`}
            />
            <p
              id="club-acronym-help"
              className="mt-1.5 text-[11px] leading-4 text-neutral-500"
            >
              3 letras de A a Z, maiúsculas, que aparecem no nome nessa ordem; a
              primeira é a primeira letra do nome.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13px] text-neutral-600">
            <Wallet size={14} strokeWidth={1.7} className="shrink-0" />
            O clube começa com {formatMoney(CAIXA_INICIAL)} em caixa e sem
            jogadores.
          </div>

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
              className="flex h-9 items-center gap-2 rounded-lg bg-[#155DFC] px-4 text-[13px] font-medium text-white shadow-sm transition hover:brightness-95 disabled:opacity-70"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Criando…" : "Criar clube"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
