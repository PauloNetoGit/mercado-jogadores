import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class BuyPlayerDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  club_id!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}-03:00$/, {
    message: 'loyalty_until deve usar o formato AAAA-MM-DDTHH:MM-03:00.',
  })
  loyalty_until!: string;
}
