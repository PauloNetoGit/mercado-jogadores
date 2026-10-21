import { divideRounded } from '../../common/money';

export type Position = 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';
export type PlayerCondition = 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';

export interface PlayerAttributes {
  posicao: Position;
  idade: number;
  potencial: number;
  velocidade: number;
  finalizacao: number;
  passe: number;
  drible: number;
  defesa: number;
  fisico: number;
}

/** Pesos (%) de velocidade, finalização, passe, drible, defesa e físico, por posição (RN06). */
const POSITION_WEIGHTS: Record<Position, number[]> = {
  GOL: [10, 0, 20, 0, 40, 30],
  ZAG: [10, 0, 15, 0, 45, 30],
  LAT: [25, 0, 20, 15, 25, 15],
  MEI: [10, 15, 35, 25, 5, 10],
  ATA: [20, 40, 10, 20, 0, 10],
};

/** Desconto por condição física, em décimos de ponto percentual (RN02). */
const CONDITION_DISCOUNT_TENTHS: Record<PlayerCondition, number> = {
  APTO: 0,
  MAL_CONDICIONADO: 150,
  DOENTE: 300,
};

const MARKET_DISCOUNT_CAP_TENTHS = -400;
const MIN_VALUE_CENTS = 100;

/** RN06: soma ponderada dos seis atributos ÷ 100, arredondada para o inteiro mais próximo (meio para cima). */
export function calculateOverall(player: PlayerAttributes): number {
  const attributes = [
    player.velocidade,
    player.finalizacao,
    player.passe,
    player.drible,
    player.defesa,
    player.fisico,
  ];
  const weights = POSITION_WEIGHTS[player.posicao];
  const weightedSum = attributes.reduce(
    (sum, attribute, index) => sum + attribute * weights[index],
    0,
  );
  return Math.floor((weightedSum + 50) / 100);
}

/** Pontos de overall dentro de uma faixa [from, to]. */
function pointsInRange(overall: number, from: number, to: number): number {
  return Math.max(0, Math.min(overall, to) - from);
}

/** RN06: valor base, calculado uma única vez no cadastro. */
export function calculateBaseValue(
  overall: number,
  age: number,
  potential: number,
): number {
  // Em centavos: 0,50 por ponto de 41 a 60, 2,00 de 61 a 75 e 6,00 de 76 a 99.
  let cents =
    pointsInRange(overall, 40, 60) * 50 +
    pointsInRange(overall, 60, 75) * 200 +
    pointsInRange(overall, 75, 99) * 600;

  if (age <= 21) {
    cents = divideRounded(cents * (100 + potential - overall), 100);
  }

  return Math.max(cents, MIN_VALUE_CENTS) / 100;
}

/** RN02 a RN05: valor de mercado, calculado a cada consulta. */
export function calculateMarketValue(
  baseValue: number,
  condition: PlayerCondition,
  agility: number,
  age: number,
): number {
  let discount = CONDITION_DISCOUNT_TENTHS[condition];

  // RN03: a agilidade só age quando o jogador não está APTO.
  if (condition !== 'APTO') {
    if (agility >= 80) discount /= 2;
    else if (agility <= 30) discount += 100;
  }

  // RN04: ajuste por idade, em décimos de ponto percentual.
  let ageAdjustment = 0;
  if (age <= 21) ageAdjustment = 100;
  else if (age >= 32) ageAdjustment = -100;

  // RN05: percentual total, com teto de desconto de 40%.
  const total = Math.max(MARKET_DISCOUNT_CAP_TENTHS, ageAdjustment - discount);

  const baseCents = Math.round(baseValue * 100);
  const cents = divideRounded(baseCents * (1000 + total), 1000);
  return Math.max(cents, MIN_VALUE_CENTS) / 100;
}
