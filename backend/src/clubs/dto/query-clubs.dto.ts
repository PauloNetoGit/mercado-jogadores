import { IsIn, IsOptional } from 'class-validator';

export const CLUB_SORTS = ['name', 'net_worth_asc', 'net_worth_desc'] as const;
export type ClubSort = (typeof CLUB_SORTS)[number];

export class QueryClubsDto {
  @IsOptional()
  @IsIn(CLUB_SORTS)
  sort: ClubSort = 'name';
}
