import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { normalizeSpaces } from '../../common/text';

export class CreateClubDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSpaces(value) : value,
  )
  @IsString()
  name: string;

  @IsString()
  acronym: string;
}
