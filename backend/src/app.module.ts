import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PlayersModule } from './players/players.module';
import { ClubsModule } from './clubs/clubs.module';
import { MarketModule } from './market/market.module';
import { LineupsModule } from './lineups/lineups.module';
import { MatchesModule } from './matches/matches.module';
import { StandingsModule } from './standings/standings.module';

@Module({
  imports: [
    PrismaModule,
    PlayersModule,
    ClubsModule,
    MarketModule,
    LineupsModule,
    MatchesModule,
    StandingsModule,
  ],
})
export class AppModule {}
