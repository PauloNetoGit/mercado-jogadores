import { describe, expect, it } from 'vitest';
import {
  calculateBaseValue,
  calculateMarketValue,
  calculateOverall,
} from './player-calculations';

describe('player calculations', () => {
  it('calculates the overall with position-specific weights and rounds half up', () => {
    expect(
      calculateOverall({
        posicao: 'ZAG',
        idade: 25,
        potencial: 70,
        velocidade: 50,
        finalizacao: 90,
        passe: 60,
        drible: 40,
        defesa: 80,
        fisico: 75,
      }),
    ).toBe(73);
  });

  it('calculates the base value and rounds a half cent away from zero', () => {
    expect(calculateBaseValue(45, 18, 90)).toBe(3.63);
  });

  it('applies condition, agility and age adjustments with the -40% floor', () => {
    expect(calculateMarketValue(82, 'DOENTE', 10, 40)).toBe(49.2);
  });

  it('halves the condition discount for high agility before applying the young-player adjustment', () => {
    expect(calculateMarketValue(30, 'MAL_CONDICIONADO', 80, 21)).toBe(30.75);
  });

  it('never returns a market value below 1.00', () => {
    expect(calculateMarketValue(1, 'DOENTE', 10, 40)).toBe(1);
  });
});
