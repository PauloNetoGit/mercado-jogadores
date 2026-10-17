import { IsInt, Min } from 'class-validator';

export class CreateMatchDto {
  @IsInt()
  @Min(1)
  home_club_id!: number;

  @IsInt()
  @Min(1)
  away_club_id!: number;
}
