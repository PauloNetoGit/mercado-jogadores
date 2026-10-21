import { BadRequestException } from '@nestjs/common';
import {
  parseDecimalParam,
  parseEnumParam,
  parseIntParam,
  readParam,
  type RawQuery,
} from '../../common/query-params';
import { foldText, hasControlChars, normalizeSpaces } from '../../common/text';
import { CONDITIONS, POSITIONS } from './player-fields';

export const SORT_CRITERIA = [
  'name',
  'value_asc',
  'value_desc',
  'age_asc',
  'age_desc',
  'position',
] as const;
export type SortCriterion = (typeof SORT_CRITERIA)[number];

export interface PlayersQuery {
  search?: string;
  position?: (typeof POSITIONS)[number];
  condition?: (typeof CONDITIONS)[number];
  free?: boolean;
  clubId?: number;
  minAge?: number;
  maxAge?: number;
  minValue?: number;
  maxValue?: number;
  sort: SortCriterion[];
  page: number;
  limit: number;
}

const sortField = (criterion: SortCriterion) => criterion.split('_')[0];

function parseSearch(query: RawQuery): string | undefined {
  const raw = readParam(query, 'search');
  if (raw === undefined) return undefined;
  if (hasControlChars(raw))
    throw new BadRequestException(
      'search não pode ter caracteres de controle.',
    );
  const search = normalizeSpaces(raw);
  if (search.length < 2 || search.length > 100) {
    throw new BadRequestException('search deve ter de 2 a 100 caracteres.');
  }
  return foldText(search);
}

function parseSort(query: RawQuery): SortCriterion[] {
  const raw = readParam(query, 'sort');
  if (raw === undefined) return ['name'];
  const criteria = raw.split(',');
  const valid = criteria.every((item) =>
    (SORT_CRITERIA as readonly string[]).includes(item),
  );
  const fields = new Set(
    criteria.map((item) => sortField(item as SortCriterion)),
  );
  if (!valid || criteria.length > 2 || fields.size !== criteria.length) {
    throw new BadRequestException(
      `sort aceita até dois critérios distintos, separados por vírgula: ${SORT_CRITERIA.join(', ')}.`,
    );
  }
  return criteria as SortCriterion[];
}

function parseFree(query: RawQuery): boolean | undefined {
  const raw = parseEnumParam(query, 'free', ['true', 'false'] as const);
  return raw === undefined ? undefined : raw === 'true';
}

/** Valida os query params de GET /players (seção 1 do enunciado). */
export function parsePlayersQuery(query: RawQuery): PlayersQuery {
  const parsed: PlayersQuery = {
    search: parseSearch(query),
    position: parseEnumParam(query, 'position', POSITIONS),
    condition: parseEnumParam(query, 'condition', CONDITIONS),
    free: parseFree(query),
    clubId: parseIntParam(query, 'club_id'),
    minAge: parseIntParam(query, 'min_age', { min: 16, max: 45 }),
    maxAge: parseIntParam(query, 'max_age', { min: 16, max: 45 }),
    minValue: parseDecimalParam(query, 'min_value', { min: 0, max: 550 }),
    maxValue: parseDecimalParam(query, 'max_value', { min: 0, max: 550 }),
    sort: parseSort(query),
    page: parseIntParam(query, 'page') ?? 1,
    limit: parseIntParam(query, 'limit', { min: 1, max: 50 }) ?? 10,
  };

  if (
    parsed.minAge !== undefined &&
    parsed.maxAge !== undefined &&
    parsed.minAge > parsed.maxAge
  ) {
    throw new BadRequestException('min_age não pode ser maior que max_age.');
  }
  if (
    parsed.minValue !== undefined &&
    parsed.maxValue !== undefined &&
    parsed.minValue > parsed.maxValue
  ) {
    throw new BadRequestException(
      'min_value não pode ser maior que max_value.',
    );
  }
  if (parsed.free === true && parsed.clubId !== undefined) {
    throw new BadRequestException(
      'free=true não pode ser combinado com club_id.',
    );
  }
  return parsed;
}
