const OFFSET_MS = 3 * 60 * 60 * 1000;
const INPUT_FORMAT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})-03:00$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** RN01 nas respostas: AAAA-MM-DDTHH:MM:SS-03:00. */
export function formatBrasilia(date: Date): string {
  const local = new Date(date.getTime() - OFFSET_MS);
  const day = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
  return `${day}T${time}-03:00`;
}

/**
 * RN01 nas requisições: AAAA-MM-DDTHH:MM-03:00. Devolve null para outro formato
 * e para data ou hora inexistente (como 30 de fevereiro ou 24:00).
 */
export function parseBrasilia(value: string): Date | null {
  const match = INPUT_FORMAT.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const exists =
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day &&
    utc.getUTCHours() === hour &&
    utc.getUTCMinutes() === minute;
  return exists ? new Date(utc.getTime() + OFFSET_MS) : null;
}
