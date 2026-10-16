export type Position = 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';

interface PlayerAttributes {
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

const POSITION_WEIGHTS: Record<Position, number[]> = {
  GOL: [10, 0, 20, 0, 40, 30],
  ZAG: [10, 0, 15, 0, 45, 30],
  LAT: [25, 0, 20, 15, 25, 15],
  MEI: [10, 15, 35, 25, 5, 10],
  ATA: [20, 40, 10, 20, 0, 10],
};

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

  return Math.floor(weightedSum / 100 + 0.5);
}

export function calculateBaseValue(
  overall: number,
  idade: number,
  potencial: number,
): number {
  let value = 0;

  if (overall > 40) {
    value += Math.min(overall, 60) - 40 > 0
      ? (Math.min(overall, 60) - 40) * 0.5
      : 0;
  }

  if (overall > 60) {
    value += (Math.min(overall, 75) - 60) * 2;
  }

  if (overall > 75) {
    value += (Math.min(overall, 99) - 75) * 6;
  }

  if (idade <= 21) {
    value *= (100 + potencial - overall) / 100;
  }

  return Math.max(1, Math.floor(value * 100 + 0.5) / 100);
}


type PlayerCondition = 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';

export function calculateMarketValue(
  baseValue: number,
  condition: PlayerCondition,
  agility: number,
  age: number,
): number {
  // RN02: desconto inicial por condição física.
  let conditionDiscount = {
    APTO: 0,
    MAL_CONDICIONADO: 15,
    DOENTE: 30,
  }[condition];

  // RN03: ajuste do desconto conforme a agilidade.
  if (condition !== 'APTO') {
    if (agility >= 80) {
      conditionDiscount /= 2;
    } else if (agility <= 30) {
      conditionDiscount += 10;
    }
  }

  // RN04: ajuste por idade.
  let ageAdjustment = 0;

  if (age <= 21) {
    ageAdjustment = 10;
  } else if (age >= 32) {
    ageAdjustment = -10;
  }

  // RN05: percentual total, limitado a -40%.
  const totalPercentage = Math.max(
    -40,
    ageAdjustment - conditionDiscount,
  );

  // Arredonda para duas casas decimais.
  const calculatedValue =
    Math.round((baseValue * (100 + totalPercentage) / 100) * 100) / 100;

  // Valor mínimo de R$ 1,00.
  return Math.max(1, calculatedValue);
}
