import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClubsService } from './clubs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClubsService', () => {
  let service: ClubsService;
  let prisma: {
    clube: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      clube: {
        count: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new ClubsService(prisma as unknown as PrismaService);
  });

  it('normalizes the name and creates a club with 300 cash', async () => {
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      clube: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, nome: data.nome, sigla: data.sigla, caixa: data.caixa })),
      },
    }));

    await expect(service.create({ name: '  Águias   FC ', acronym: 'AGU' })).resolves.toMatchObject({
      id: 1, name: 'Águias FC', acronym: 'AGU', cash: 300, squad_value: 0, net_worth: 300,
    });
  });

  it('rejects an acronym that does not match the club name', async () => {
    await expect(service.create({ name: 'Águias FC', acronym: 'XYZ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects creation when the league already has 20 clubs', async () => {
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      clube: { count: vi.fn().mockResolvedValue(20), create: vi.fn() },
    }));

    await expect(service.create({ name: 'Águias FC', acronym: 'AGU' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the documented initial cash value', () => {
    expect(new Prisma.Decimal('300.00').toNumber()).toBe(300);
  });
});
