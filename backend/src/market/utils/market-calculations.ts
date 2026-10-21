import { divideRounded } from '../../common/money';

const FEE_FREE_LIMIT_CENTS = 3_000;
const PENALTY_CAP_CENTS = 1_000;
const COMMISSION_BRACKET_CENTS = 1_000;

/** RN13: taxa de 5%, cobrada só quando o valor de mercado passa de 30,00. */
export function purchaseFeeCents(valueCents: number): number {
  return valueCents > FEE_FREE_LIMIT_CENTS
    ? divideRounded(valueCents * 5, 100)
    : 0;
}

/** RN15: multa pelo percentual da fidelidade, limitada a 10,00. */
export function penaltyCents(valueCents: number, penaltyRate: number): number {
  return Math.min(
    PENALTY_CAP_CENTS,
    divideRounded(valueCents * penaltyRate, 100),
  );
}

/** RN16: 10% sobre a parte do lucro até 10,00 mais 20% sobre o que passa disso; sem lucro, nada. */
export function commissionCents(profitCents: number): number {
  if (profitCents <= 0) return 0;
  const lowerPart = Math.min(profitCents, COMMISSION_BRACKET_CENTS);
  const upperPart = profitCents - lowerPart;
  return divideRounded(lowerPart * 10 + upperPart * 20, 100);
}
