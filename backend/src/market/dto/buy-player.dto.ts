import { IsInt, IsString, Max, Min } from 'class-validator';
import { MAX_ID } from '../../common/parse-id.pipe';

export class BuyPlayerDto {
  @IsInt()
  @Min(1)
  @Max(MAX_ID)
  club_id: number;

  @IsString()
  loyalty_until: string;
}
