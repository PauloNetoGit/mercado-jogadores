import type { Jogador } from '@prisma/client';
import {
  calculateMarketValue,
  calculateOverall,
  type PlayerCondition,
  type Position,
} from './utils/player-calculations';

export const POSITION_ORDER: Record<Position, number> = {
  GOL: 0,
  ZAG: 1,
  LAT: 2,
  MEI: 3,
  ATA: 4,
};

export function marketValueOf(player: Jogador): number {
  return calculateMarketValue(
    Number(player.valor_base),
    player.condicao as PlayerCondition,
    player.agilidade,
    player.idade,
  );
}

export type OverallInput = Pick<
  Jogador,
  | 'posicao'
  | 'idade'
  | 'potencial'
  | 'velocidade'
  | 'finalizacao'
  | 'passe'
  | 'drible'
  | 'defesa'
  | 'fisico'
>;

export function overallOf(player: OverallInput): number {
  return calculateOverall({
    posicao: player.posicao as Position,
    idade: player.idade,
    potencial: player.potencial,
    velocidade: player.velocidade,
    finalizacao: player.finalizacao,
    passe: player.passe,
    drible: player.drible,
    defesa: player.defesa,
    fisico: player.fisico,
  });
}

/** Formato de GET /players/{id}, também usado nas listas, no elenco e na escalação. */
export function toPlayerResponse(player: Jogador) {
  return {
    id: player.id,
    name: player.nome,
    position: player.posicao,
    agility: player.agilidade,
    age: player.idade,
    condition: player.condicao,
    base_value: Number(player.valor_base),
    market_value: marketValueOf(player),
    pace: player.velocidade,
    shooting: player.finalizacao,
    passing: player.passe,
    dribbling: player.drible,
    defending: player.defesa,
    physical: player.fisico,
    potential: player.potencial,
    overall: overallOf(player),
    club_id: player.clube_id,
  };
}

export type PlayerResponse = ReturnType<typeof toPlayerResponse>;
