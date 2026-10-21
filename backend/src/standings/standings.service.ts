import { Injectable } from '@nestjs/common';
import { compareNames } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

type Standing = {
  club_id: number;
  club_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const [clubs, matches] = await Promise.all([
      this.prisma.clube.findMany({ select: { id: true, nome: true } }),
      this.prisma.partida.findMany({
        select: {
          mandante_id: true,
          visitante_id: true,
          gols_mandante: true,
          gols_visitante: true,
        },
      }),
    ]);
    const table = new Map<number, Standing>();
    for (const club of clubs) {
      table.set(club.id, {
        club_id: club.id,
        club_name: club.nome,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
      });
    }
    for (const match of matches) {
      const home = table.get(match.mandante_id);
      const away = table.get(match.visitante_id);
      if (!home || !away) continue;
      home.played += 1;
      away.played += 1;
      home.goals_for += match.gols_mandante;
      home.goals_against += match.gols_visitante;
      away.goals_for += match.gols_visitante;
      away.goals_against += match.gols_mandante;
      if (match.gols_mandante > match.gols_visitante) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (match.gols_mandante < match.gols_visitante) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    }
    const sorted = [...table.values()]
      .map((row) => ({
        ...row,
        goal_difference: row.goals_for - row.goals_against,
      }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goal_difference - a.goal_difference ||
          b.goals_for - a.goals_for ||
          compareNames(a.club_name, b.club_name) ||
          a.club_id - b.club_id,
      );
    return sorted.map((row, index) => ({ position: index + 1, ...row }));
  }
}
