import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

export class QueryPlayersDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'])
  position?: 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(45)
  age_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(45)
  age_max?: number;

  @IsOptional()
  @IsIn(['APTO', 'MAL_CONDICIONADO', 'DOENTE'])
  condition?: 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  club_id?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  free?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsIn([
    'name',
    'age',
    'overall',
    'base_value',
    'potential',
    'created_at',
    'market_value',
    'position',
  ])
  sort_by = 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}