
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StandingsService } from './standings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StandingsService', () => {
  let service: StandingsService;

  const prisma = {
    clube: { findMany: vi.fn() },
    partida: { findMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StandingsService(prisma as unknown as PrismaService);
  });

  it('calculates points, records and goal difference from match history', async () => {
    prisma.clube.findMany.mockResolvedValue([
      { id: 1, nome: 'Águias FC' },
      { id: 2, nome: 'Delta FC' },
      { id: 3, nome: 'Beta FC' },
    ]);

    prisma.partida.findMany.mockResolvedValue([
      { mandante_id: 1, visitante_id: 2, gols_mandante: 2, gols_visitante: 0 },
      { mandante_id: 2, visitante_id: 3, gols_mandante: 1, gols_visitante: 1 },
      { mandante_id: 3, visitante_id: 1, gols_mandante: 3, gols_visitante: 1 },
    ]);

    await expect(service.findAll()).resolves.toEqual([
      {
        position: 1,
        club_id: 3,
        club_name: 'Beta FC',
        played: 2,
        wins: 1,
        draws: 1,
        losses: 0,
        goals_for: 4,
        goals_against: 2,
        goal_difference: 2,
        points: 4,
      },
      {
        position: 2,
        club_id: 1,
        club_name: 'Águias FC',
        played: 2,
        wins: 1,
        draws: 0,
        losses: 1,
        goals_for: 3,
        goals_against: 3,
        goal_difference: 0,
        points: 3,
      },
      {
        position: 3,
        club_id: 2,
        club_name: 'Delta FC',
        played: 2,
        wins: 0,
        draws: 1,
        losses: 1,
        goals_for: 1,
        goals_against: 3,
        goal_difference: -2,
        points: 1,
      },
    ]);
  });

  it('includes clubs without matches and sorts tied clubs by normalized name', async () => {
    prisma.clube.findMany.mockResolvedValue([
      { id: 2, nome: 'Épsilon FC' },
      { id: 1, nome: 'Delta FC' },
    ]);
    prisma.partida.findMany.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toMatchObject([
      { position: 1, club_id: 1, played: 0, points: 0 },
      { position: 2, club_id: 2, played: 0, points: 0 },
    ]);
  });

  it('uses goal difference as the first tiebreaker after points', async () => {
    prisma.clube.findMany.mockResolvedValue([
      { id: 1, nome: 'Clube A' },
      { id: 2, nome: 'Clube B' },
    ]);

    prisma.partida.findMany.mockResolvedValue([
      { mandante_id: 1, visitante_id: 2, gols_mandante: 3, gols_visitante: 0 },
      { mandante_id: 2, visitante_id: 1, gols_mandante: 2, gols_visitante: 0 },
    ]);

    const table = await service.findAll();

    expect(table.map(({ club_id, points, goal_difference }) => ({
      club_id,
      points,
      goal_difference,
    }))).toEqual([
      { club_id: 1, points: 3, goal_difference: 1 },
      { club_id: 2, points: 3, goal_difference: -1 },
    ]);
  });

  it('uses normalized club name when points, goal difference and goals scored are tied', async () => {
    prisma.clube.findMany.mockResolvedValue([
      { id: 1, nome: 'Épsilon FC' },
      { id: 2, nome: 'Delta FC' },
    ]);
    prisma.partida.findMany.mockResolvedValue([]);

    const table = await service.findAll();

    expect(table.map(({ position, club_id, club_name }) => ({
      position,
      club_id,
      club_name,
    }))).toEqual([
      { position: 1, club_id: 2, club_name: 'Delta FC' },
      { position: 2, club_id: 1, club_name: 'Épsilon FC' },
    ]);
  });

});
