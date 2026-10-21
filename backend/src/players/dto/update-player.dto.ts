import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizeSpaces } from '../../common/text';
import { POSITIONS } from './player-fields';

const normalizeName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeSpaces(value) : value;

/** PUT: só nome, posição, agilidade e idade; indicadores, potencial e valor base são ignorados (V7). */
export class UpdatePlayerDto {
  @Transform(normalizeName)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]*$/u, {
    message: 'name não pode ter caracteres de controle.',
  })
  @Matches(/^[^0-9]*$/, { message: 'name não pode ter dígitos.' })
  @Matches(/^(?=.*\p{L}\S* \S*\p{L})/u, {
    message: 'name deve ter pelo menos duas palavras.',
  })
  name: string;

  @IsIn(POSITIONS)
  position: (typeof POSITIONS)[number];

  @IsInt()
  @Min(1)
  @Max(100)
  agility: number;

  @IsInt()
  @Min(16)
  @Max(45)
  age: number;
}
