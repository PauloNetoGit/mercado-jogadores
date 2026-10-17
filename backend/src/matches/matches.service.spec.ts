
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MatchesService', () => {
  let service: MatchesService;

  const tx = {
    clube: {
      findMany: vi.fn(),
    },
    escalacao: {
      findMany: vi.fn(),
    },
    partida: {
      create: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    service = new MatchesService(
      prisma as unknown as PrismaService,
    );
  });

  it('rejects the same club as home and away before opening a transaction', async () => {
    await expect(
      service.create({ home_club_id: 1, away_club_id: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects non-positive or non-integer club ids before opening a transaction', async () => {
    await expect(
      service.create({ home_club_id: 0, away_club_id: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create({ home_club_id: 1.5, away_club_id: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });


it('creates a valid match with six duels, three attacks per club', async () => {
  const positions = ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'];

  const makeLineup = (clubId: number) =>
    positions.map((posicao, index) => ({
      clube_id: clubId,
      jogador: {
        id: clubId * 10 + index + 1,
        nome: `Jogador ${clubId}-${index + 1}`,
        posicao,
        condicao: 'APTO',
        finalizacao: 80,
        passe: 80,
        drible: 80,
        defesa: 20,
      },
    }));

  tx.clube.findMany.mockResolvedValue([
    { id: 1, nome: 'Clube A', formacao: '4-1' },
    { id: 2, nome: 'Clube B', formacao: '4-1' },
  ]);

  tx.escalacao.findMany.mockResolvedValue([
    ...makeLineup(1),
    ...makeLineup(2),
  ]);

  tx.partida.create.mockImplementation(async ({ data }: any) => ({
      id: 100,
      jogada_em: new Date('2026-10-16T12:00:00.000Z'),
      mandante_id: data.mandante_id,
      visitante_id: data.visitante_id,
      gols_mandante: data.gols_mandante,
      gols_visitante: data.gols_visitante,
      formacao_mandante: data.formacao_mandante,
      formacao_visitante: data.formacao_visitante,
      duelos: data.duelos.create.map((duel: any, index: number) => ({
        ordem: duel.ordem,
        clube_atacante_id: duel.clube_atacante_id,
        atacante_id: duel.atacante_id,
        defensor_id: duel.defensor_id,
        nome_atacante: duel.nome_atacante,
        nome_defensor: duel.nome_defensor,
        posicao_atacante: duel.posicao_atacante,
        posicao_defensor: duel.posicao_defensor,
        condicao_atacante: duel.condicao_atacante,
        condicao_defensor: duel.condicao_defensor,
        atributo_ataque: duel.atributo_ataque,
        atributo_defesa: duel.atributo_defesa,
        valor_ataque: duel.valor_ataque,
        valor_defesa: duel.valor_defesa,
        gol: duel.gol,
      })),
    }));

    const result = await service.create({
      home_club_id: 1,
      away_club_id: 2,
    });

    expect(tx.partida.create).toHaveBeenCalledOnce();

    const createArgs = tx.partida.create.mock.calls[0][0] as any;
    const duels = createArgs.data.duelos.create;

    expect(duels).toHaveLength(6);
    expect(duels.filter((duel: any) => duel.clube_atacante_id === 1)).toHaveLength(3);
    expect(duels.filter((duel: any) => duel.clube_atacante_id === 2)).toHaveLength(3);

    expect(result.id).toBe(100);
    expect(result.home.club_name).toBe('Clube A');
    expect(result.away.club_name).toBe('Clube B');
    expect(result.duels).toHaveLength(6);
    expect(result.result).toBe('EMPATE');
  });


  it('rejects the match when one of the clubs does not exist', async () => {
    tx.clube.findMany.mockResolvedValue([
      { id: 1, nome: 'Clube A', formacao: '4-1' },
    ]);

    await expect(
      service.create({ home_club_id: 1, away_club_id: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.escalacao.findMany).not.toHaveBeenCalled();
    expect(tx.partida.create).not.toHaveBeenCalled();
  });

  it('rejects the match when the home club has an incomplete lineup', async () => {
    tx.clube.findMany.mockResolvedValue([
      { id: 1, nome: 'Clube A', formacao: '4-1' },
      { id: 2, nome: 'Clube B', formacao: '4-1' },
    ]);

    tx.escalacao.findMany.mockResolvedValue([]);

    await expect(
      service.create({ home_club_id: 1, away_club_id: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.partida.create).not.toHaveBeenCalled();
  });


  it('rejects the match when the away club has an incomplete lineup', async () => {
    tx.clube.findMany.mockResolvedValue([
      { id: 1, nome: 'Clube A', formacao: '4-1' },
      { id: 2, nome: 'Clube B', formacao: '4-1' },
    ]);

    tx.escalacao.findMany.mockResolvedValue(
      ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'].map((posicao, index) => ({
        clube_id: 1,
        jogador: {
          id: index + 1,
          nome: `Jogador ${index + 1}`,
          posicao,
          condicao: 'APTO',
        },
      })),
    );

    await expect(
      service.create({ home_club_id: 1, away_club_id: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.partida.create).not.toHaveBeenCalled();
  });

  it('rejects the match when the home lineup contains a sick player', async () => {
    tx.clube.findMany.mockResolvedValue([
      { id: 1, nome: 'Clube A', formacao: '4-1' },
      { id: 2, nome: 'Clube B', formacao: '4-1' },
    ]);

    tx.escalacao.findMany.mockResolvedValue(
      ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'].map((posicao, index) => ({
        clube_id: 1,
        jogador: {
          id: index + 1,
          nome: `Jogador ${index + 1}`,
          posicao,
          condicao: index === 0 ? 'DOENTE' : 'APTO',
        },
      })),
    );

    await expect(
      service.create({ home_club_id: 1, away_club_id: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.partida.create).not.toHaveBeenCalled();
  });


  it('applies the 15% condition penalty with half-up integer rounding and scores only when attack is greater', () => {
    const calculateDuel = (
      service as unknown as {
        calculateDuel: (spec: any) => any;
      }
    ).calculateDuel.bind(service);

    const basePlayer = {
      id: 1,
      nome: 'Atacante',
      posicao: 'ATA',
      finalizacao: 50,
      passe: 50,
      drible: 50,
      defesa: 50,
      condicao: 'MAL_CONDICIONADO',
    };

    const defender = {
      ...basePlayer,
      id: 2,
      nome: 'Defensor',
      posicao: 'GOL',
      defesa: 43,
      condicao: 'APTO',
    };

    const tied = calculateDuel({
      order: 1,
      attackingClubId: 1,
      attacker: basePlayer,
      defender,
    });

    expect(tied.attacker.value).toBe(43);
    expect(tied.goal).toBe(false);

    const scoring = calculateDuel({
      order: 1,
      attackingClubId: 1,
      attacker: { ...basePlayer, finalizacao: 52 },
      defender,
    });

    expect(scoring.attacker.value).toBe(44);
    expect(scoring.goal).toBe(true);
  });
});
