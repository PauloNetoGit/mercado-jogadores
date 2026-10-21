import { BadRequestException } from '@nestjs/common';
import {
  parseIntParam,
  readParam,
  type RawQuery,
} from '../../common/query-params';

export type TransactionType = 'COMPRA' | 'VENDA';
const TYPES: readonly string[] = ['COMPRA', 'VENDA'];

export interface TransactionsFilter {
  types?: TransactionType[];
  playerId?: number;
}

/** Filtros `type` e `player_id` do histórico e da exportação (seção 1 do enunciado). */
export function parseTransactionsFilter(query: RawQuery): TransactionsFilter {
  const rawType = readParam(query, 'type');
  let types: TransactionType[] | undefined;
  if (rawType !== undefined) {
    const parts = rawType.split(',');
    if (
      parts.some((part) => !TYPES.includes(part)) ||
      new Set(parts).size !== parts.length
    ) {
      throw new BadRequestException(
        'type aceita COMPRA e VENDA, separados por vírgula, sem espaços e sem repetição.',
      );
    }
    types = parts as TransactionType[];
  }
  return { types, playerId: parseIntParam(query, 'player_id') };
}
