import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LineupsService } from './lineups.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LineupsService', () => {
  let service: LineupsService;
  const prisma = { $transaction: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LineupsService(prisma as unknown as PrismaService);
  });

  it('rejects repeated player ids before opening a transaction', async () => {
    await expect(service.replace(1, { formation: '2-1-1', player_ids: [1, 2, 3, 4, 4] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an unsupported formation before opening a transaction', async () => {
    await expect(service.replace(1, { formation: '4-0' as any, player_ids: [1, 2, 3, 4, 5] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
