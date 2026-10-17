import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';

export const FORMATIONS = ['3-1', '2-2', '2-1-1', '1-2-1'] as const;
export type Formation = (typeof FORMATIONS)[number];

export class UpdateLineupDto {
  @IsIn(FORMATIONS, {
    message: 'formation deve ser 3-1, 2-2, 2-1-1 ou 1-2-1.',
  })
  formation!: Formation;

  @IsArray({ message: 'player_ids deve ser uma lista de ids.' })
  @ArrayMinSize(5, { message: 'player_ids deve conter exatamente 5 ids.' })
  @ArrayMaxSize(5, { message: 'player_ids deve conter exatamente 5 ids.' })
  @ArrayUnique({ message: 'player_ids não pode conter ids repetidos.' })
  @IsInt({ each: true, message: 'Cada id em player_ids deve ser um inteiro.' })
  @Min(1, { each: true, message: 'Cada id em player_ids deve ser positivo.' })
  player_ids!: number[];
}
