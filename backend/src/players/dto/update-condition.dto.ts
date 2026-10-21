import { IsIn } from 'class-validator';
import { CONDITIONS } from './player-fields';

export class UpdateConditionDto {
  @IsIn(CONDITIONS)
  condition: (typeof CONDITIONS)[number];
}
