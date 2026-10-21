import { BadRequestException } from '@nestjs/common';

const MAX_ATTRIBUTE_SUM = 480;
const AGE_FOR_FIXED_POTENTIAL = 33;
const AGE_FOR_AGILITY_CAP = 35;
const AGILITY_CAP = 85;

export interface PlayerIndicators {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  potential: number;
}

/** Limite de agilidade que depende da idade (400 no cadastro e na edição). */
export function assertAgilityForAge(agility: number, age: number): void {
  if (age >= AGE_FOR_AGILITY_CAP && agility > AGILITY_CAP) {
    throw new BadRequestException(
      `Com ${AGE_FOR_AGILITY_CAP} anos ou mais, agility vai até ${AGILITY_CAP}.`,
    );
  }
}

/** Limites do cadastro que dependem de mais de um campo (400). */
export function assertCreationRules(
  indicators: PlayerIndicators,
  age: number,
  agility: number,
): void {
  const attributes = [
    indicators.pace,
    indicators.shooting,
    indicators.passing,
    indicators.dribbling,
    indicators.defending,
    indicators.physical,
  ];
  const highest = Math.max(...attributes);

  if (attributes.reduce((sum, value) => sum + value, 0) > MAX_ATTRIBUTE_SUM) {
    throw new BadRequestException(
      `A soma dos seis atributos não pode passar de ${MAX_ATTRIBUTE_SUM}.`,
    );
  }
  if (indicators.potential < highest) {
    throw new BadRequestException(
      'potential deve ser maior ou igual ao maior dos seis atributos.',
    );
  }
  if (age >= AGE_FOR_FIXED_POTENTIAL && indicators.potential !== highest) {
    throw new BadRequestException(
      `Com ${AGE_FOR_FIXED_POTENTIAL} anos ou mais, potential deve ser igual ao maior dos seis atributos.`,
    );
  }
  assertAgilityForAge(agility, age);
}
