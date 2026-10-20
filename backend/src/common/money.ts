import { Prisma } from '@prisma/client';

/**
 * Divisão inteira com arredondamento do enunciado: o meio arredonda para longe do zero.
 * Todo cálculo em moedas é feito em centavos inteiros, para não haver erro de ponto flutuante.
 */
export function divideRounded(numerator: number, denominator: number): number {
  const quotient = Math.floor(
    (Math.abs(numerator) * 2 + denominator) / (denominator * 2),
  );
  return numerator < 0 ? -quotient : quotient;
}

export function toCents(value: Prisma.Decimal | number | string): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function decimalFromCents(cents: number): Prisma.Decimal {
  return new Prisma.Decimal((cents / 100).toFixed(2));
}

export function formatMoneyCsv(
  value: Prisma.Decimal | number | string | null,
): string {
  if (value === null) return '';
  return Number(value).toFixed(2).replace('.', ',');
}
