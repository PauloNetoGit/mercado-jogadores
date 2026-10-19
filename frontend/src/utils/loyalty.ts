/**
 * Fim da fidelidade: data e hora digitadas no horário de Brasília (UTC−3, sem
 * horário de verão) e enviadas no formato da RN01 (AAAA-MM-DDTHH:MM-03:00).
 * Nada aqui passa pelo fuso do navegador.
 */

const DAY_MS = 86_400_000;
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
export const MAX_FIDELIDADE_DIAS = 1_095;

const pad = (n: number) => String(n).padStart(2, "0");

/** Máscara dd/mm/aaaa enquanto o usuário digita. */
export function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Máscara HH:MM enquanto o usuário digita. */
export function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Sugestão inicial: mesmo dia do ano seguinte, na próxima hora cheia (Brasília). */
export function defaultLoyalty(now = new Date()): { date: string; time: string } {
  const local = new Date(now.getTime() - BRASILIA_OFFSET_MS);
  const target = new Date(
    Date.UTC(
      local.getUTCFullYear() + 1,
      local.getUTCMonth(),
      local.getUTCDate(),
      local.getUTCHours() + 1,
      0,
    ),
  );
  return {
    date: `${pad(target.getUTCDate())}/${pad(target.getUTCMonth() + 1)}/${target.getUTCFullYear()}`,
    time: `${pad(target.getUTCHours())}:${pad(target.getUTCMinutes())}`,
  };
}

export interface LoyaltyFieldErrors {
  date?: string;
  time?: string;
}

/** Valida só o que dá para saber com o campo sozinho (formato, existência e faixa). */
export function parseLoyalty(
  dateText: string,
  timeText: string,
  now = new Date(),
): { value: string; errors?: undefined } | { value?: undefined; errors: LoyaltyFieldErrors } {
  const errors: LoyaltyFieldErrors = {};

  const dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText.trim());
  const tm = /^(\d{2}):(\d{2})$/.exec(timeText.trim());

  if (!dateText.trim()) errors.date = "Informe a data do fim da fidelidade.";
  else if (!dm) errors.date = "Use o formato dd/mm/aaaa.";

  if (!timeText.trim()) errors.time = "Informe a hora.";
  else if (!tm) errors.time = "Use o formato hh:mm.";

  if (!dm || !tm) return { errors };

  const [y, mo, d] = [Number(dm[3]), Number(dm[2]), Number(dm[1])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];

  const dayOnly = new Date(Date.UTC(y, mo - 1, d));
  const dateExists =
    dayOnly.getUTCFullYear() === y &&
    dayOnly.getUTCMonth() === mo - 1 &&
    dayOnly.getUTCDate() === d;
  const timeExists = h <= 23 && mi <= 59;

  if (!dateExists) errors.date = "Essa data não existe.";
  if (!timeExists) errors.time = "Essa hora não existe.";
  if (errors.date || errors.time) return { errors };

  const instant = Date.UTC(y, mo - 1, d, h, mi) + BRASILIA_OFFSET_MS;
  const delta = instant - now.getTime();
  if (delta <= 0) {
    errors.date = "O fim da fidelidade deve ser depois do momento da compra.";
    return { errors };
  }
  if (delta > MAX_FIDELIDADE_DIAS * DAY_MS) {
    errors.date = "O fim da fidelidade pode ir até 1.095 dias depois da compra.";
    return { errors };
  }

  return { value: `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}-03:00` };
}

/** "2027-11-12T15:00:00-03:00" -> "12/11/2027, 15:00" (já está em Brasília). */
export function formatBrasilia(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}, ${m[4]}:${m[5]}` : iso;
}
