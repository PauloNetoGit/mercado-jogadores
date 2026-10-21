import { describe, expect, it } from 'vitest';
import { calculateLoyaltyPenalty } from './loyalty-penalty';
import {
  commissionCents,
  penaltyCents,
  purchaseFeeCents,
} from './market-calculations';

describe('RN13 taxa de compra (tabela do README)', () => {
  it.each([
    [2800, 0],
    [3000, 0],
    [3001, 150],
    [4762, 238],
    [4800, 240],
  ])('valor %i centavos -> taxa %i', (value, fee) => {
    expect(purchaseFeeCents(value)).toBe(fee);
  });
});

describe('RN15 multa por fidelidade', () => {
  const now = new Date('2026-10-20T12:00:00-03:00');
  const after = (ms: number) => new Date(now.getTime() + ms);
  const DAY = 86_400_000;
  const MIN = 60_000;

  it.each([
    [-DAY, 0, 0],
    [0, 0, 0],
    [10 * DAY + 2 * 3_600_000, 11, 5],
    [30 * DAY, 30, 5],
    [30 * DAY + MIN, 31, 10],
    [180 * DAY, 180, 10],
    [180 * DAY + MIN, 181, 20],
    [200 * DAY, 200, 20],
  ])('faltando %i ms -> %i dias, %i%%', (offset, days, rate) => {
    expect(calculateLoyaltyPenalty(after(offset), now)).toEqual({
      remainingDays: days,
      penaltyRate: rate,
    });
  });

  it('limita a multa a 10,00', () => {
    expect(penaltyCents(7500, 20)).toBe(1000);
    expect(penaltyCents(4000, 10)).toBe(400);
  });
});

describe('RN16 comissão progressiva (tabela do README)', () => {
  it.each([
    [300, 30],
    [385, 39],
    [1000, 100],
    [1001, 100],
    [1500, 200],
    [-750, 0],
    [0, 0],
  ])('lucro %i centavos -> comissão %i', (profit, commission) => {
    expect(commissionCents(profit)).toBe(commission);
  });
});
