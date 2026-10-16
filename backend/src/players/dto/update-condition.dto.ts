import { IsIn } from 'class-validator';

export class UpdateConditionDto {
  @IsIn(['APTO', 'MAL_CONDICIONADO', 'DOENTE'])
  condition: 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';
}