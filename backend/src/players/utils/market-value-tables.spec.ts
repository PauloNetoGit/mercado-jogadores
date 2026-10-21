import { describe, expect, it } from 'vitest';
import { divideRounded } from '../../common/money';
import { calculateMarketValue } from './player-calculations';

describe('arredondamento', () => {
  it('arredonda a metade para longe do zero', () => {
    expect(divideRounded(5, 10)).toBe(1);
    expect(divideRounded(-5, 10)).toBe(-1);
    expect(divideRounded(4, 10)).toBe(0);
  });
});

describe('valor de mercado', () => {
  it('APTO sem ajuste de idade mantém o valor base', () => {
    expect(calculateMarketValue(50, 'APTO', 50, 27)).toBe(50);
  });

  it('jovem ganha 10% e veterano perde 10%', () => {
    expect(calculateMarketValue(50, 'APTO', 50, 20)).toBe(55);
    expect(calculateMarketValue(50, 'APTO', 50, 33)).toBe(45);
  });

  it('o desconto total nunca passa de 40%', () => {
    expect(calculateMarketValue(100, 'DOENTE', 10, 40)).toBe(60);
  });
});
