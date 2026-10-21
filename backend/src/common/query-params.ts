import { BadRequestException } from '@nestjs/common';
import { MAX_ID } from './parse-id.pipe';

export type RawQuery = Record<string, unknown>;

/** Valor do parâmetro como texto; ausente → undefined; vazio ou repetido → 400. */
export function readParam(query: RawQuery, name: string): string | undefined {
  const raw = query[name];
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new BadRequestException(`${name} é inválido.`);
  }
  return raw;
}

/** Inteiro positivo só com dígitos, sem sinal, sem zeros à esquerda e sem expoente. */
export function parseIntParam(
  query: RawQuery,
  name: string,
  limits: { min?: number; max?: number } = {},
): number | undefined {
  const raw = readParam(query, name);
  if (raw === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new BadRequestException(`${name} deve ser um inteiro positivo.`);
  }
  const value = Number(raw);
  const { min = 1, max = MAX_ID } = limits;
  if (value < min || value > max) {
    throw new BadRequestException(`${name} deve estar entre ${min} e ${max}.`);
  }
  return value;
}

/** Decimal na forma 10, 10.5 ou 10.55 (sem sinal, sem expoente, sem vírgula, sem zeros à esquerda). */
export function parseDecimalParam(
  query: RawQuery,
  name: string,
  limits: { min: number; max: number },
): number | undefined {
  const raw = readParam(query, name);
  if (raw === undefined) return undefined;
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(raw)) {
    throw new BadRequestException(
      `${name} deve ter a forma 10, 10.5 ou 10.55.`,
    );
  }
  const value = Number(raw);
  if (value < limits.min || value > limits.max) {
    throw new BadRequestException(
      `${name} deve estar entre ${limits.min} e ${limits.max}.`,
    );
  }
  return value;
}

export function parseEnumParam<T extends string>(
  query: RawQuery,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const raw = readParam(query, name);
  if (raw === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new BadRequestException(
      `${name} deve ser um de: ${allowed.join(', ')}.`,
    );
  }
  return raw as T;
}
