import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { calculateMarketValue } from '../players/utils/player-calculations';

const DAY_MS = 86_400_000;

function futureLoyaltyDate(days = 30): string {
  const date = new Date(Date.now() + days * DAY_MS - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}-03:00`;
}

function makePlayer(clubId: number | null = null) {
  return {
    id: 2,
    nome: 'Carlos Teste',
    clube_id: clubId,
    excluido_em: null,
    valor_base: new Prisma.Decimal('100.00'),
    condicao: 'APTO',
    agilidade: 80,
    idade: 20,
  };
}

function playerValueCents(): number {
  return Math.round(calculateMarketValue(100, 'APTO', 80, 20) * 100);
}

describe('MarketService', () => {
  let service: MarketService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(),
      clube: {
        findUnique: vi.fn(),
      },
      jogador: {
        findFirst: vi.fn(),
      },
      transacao: {
        findMany: vi.fn(),
      },
    };

    service = new MarketService(prisma as unknown as PrismaService);
  });

  function setupBuy(options: {
    playerClubId?: number | null;
    cash?: string;
    clubExists?: boolean;
  } = {}) {
    const player = makePlayer(options.playerClubId ?? null);
    const club = options.clubExists === false
      ? null
      : { id: 1, caixa: new Prisma.Decimal(options.cash ?? '300.00') };

    const tx = {
      jogador: {
        findFirst: vi.fn().mockResolvedValue(player),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      clube: {
        findUnique: vi.fn().mockResolvedValue(club),
        update: vi.fn().mockResolvedValue({}),
      },
      transacao: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 1, ...data }),
        ),
      },
      contrato: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: any) => any) => callback(tx),
    );

    return { tx, player, club };
  }

  function setupSell(options: {
    loyaltyDays?: number;
    loyaltyMs?: number;
    purchaseCents?: number;
    cash?: string;
  } = {}) {
    const player = makePlayer(1);
    const valueCents = playerValueCents();
    const purchaseCents = options.purchaseCents ?? valueCents;

    const now = Date.now();
    const loyaltyUntil = options.loyaltyMs !== undefined
      ? now + options.loyaltyMs
      : now + (options.loyaltyDays ?? 365) * DAY_MS;

    const contract = {
      id: 10,
      jogador_id: 2,
      clube_id: 1,
      valor_compra: new Prisma.Decimal((purchaseCents / 100).toFixed(2)),
      fidelidade_ate: new Date(loyaltyUntil),
      situacao: 'ATIVO',
    };

    const tx = {
      jogador: {
        findFirst: vi.fn().mockResolvedValue(player),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      contrato: {
        findFirst: vi.fn().mockResolvedValue(contract),
        update: vi.fn().mockResolvedValue({}),
      },
      clube: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 1,
          caixa: new Prisma.Decimal(options.cash ?? '179.49'),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      escalacao: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      transacao: {
        create: vi.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 2, ...data }),
        ),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: any) => any) => callback(tx),
    );

    return { tx, player, contract, valueCents, purchaseCents };
  }

  // Validação de IDs e datas

  it('rejects malformed player ids as not found', async () => {
    await expect(
      service.buy('01', {
        club_id: 1,
        loyalty_until: futureLoyaltyDate(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects loyalty dates without the required Brasilia offset', async () => {
    await expect(
      service.buy('1', {
        club_id: 1,
        loyalty_until: '2027-01-01T10:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects impossible calendar dates rather than silently normalizing them', async () => {
    await expect(
      service.buy('1', {
        club_id: 1,
        loyalty_until: '2027-02-30T10:00-03:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Compra

  it('buys a free player and records the contract and transaction', async () => {
    const { tx } = setupBuy();
    const valueCents = playerValueCents();
    const feeCents = valueCents > 3000
      ? Math.floor(valueCents * 0.05 + 0.5)
      : 0;
    const expectedCash = (30000 - valueCents - feeCents) / 100;

    const result = await service.buy('2', {
      club_id: 1,
      loyalty_until: futureLoyaltyDate(),
    });

    expect(result).toMatchObject({
      type: 'COMPRA',
      player_id: 2,
      club_id: 1,
      value: valueCents / 100,
      fee: feeCents / 100,
      cash_change: -(valueCents + feeCents) / 100,
      club_cash: expectedCash,
      contract: { status: 'ATIVO' },
    });
    expect(tx.jogador.updateMany).toHaveBeenCalled();
    expect(tx.contrato.create).toHaveBeenCalled();
    expect(tx.clube.update).toHaveBeenCalled();
    expect(tx.transacao.create).toHaveBeenCalled();
  });

  it('rejects a purchase when the cost exceeds 50% of club cash', async () => {
    const { tx } = setupBuy({ cash: '100.00' });

    await expect(
      service.buy('2', {
        club_id: 1,
        loyalty_until: futureLoyaltyDate(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.jogador.updateMany).not.toHaveBeenCalled();
    expect(tx.contrato.create).not.toHaveBeenCalled();
    expect(tx.transacao.create).not.toHaveBeenCalled();
  });

  it('rejects buying a player who already belongs to a club', async () => {
    setupBuy({ playerClubId: 3 });

    await expect(
      service.buy('2', {
        club_id: 1,
        loyalty_until: futureLoyaltyDate(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects buying when the destination club does not exist', async () => {
    setupBuy({ clubExists: false });

    await expect(
      service.buy('2', {
        club_id: 1,
        loyalty_until: futureLoyaltyDate(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // Venda

  it('rejects selling a player who is already free', async () => {
    const tx = {
      jogador: {
        findFirst: vi.fn().mockResolvedValue(makePlayer(null)),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: any) => any) => callback(tx),
    );

    await expect(service.sell('2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects selling a player without an active contract', async () => {
    const tx = {
      jogador: {
        findFirst: vi.fn().mockResolvedValue(makePlayer(1)),
      },
      contrato: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: any) => any) => callback(tx),
    );

    await expect(service.sell('2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('sells a player with a loyalty penalty and calculates commission', async () => {
    const valueCents = playerValueCents();
    const purchaseCents = valueCents - 2000;
    const { tx } = setupSell({
      loyaltyDays: 365,
      purchaseCents,
      cash: '179.49',
    });

    const profitCents = valueCents - purchaseCents;
    const commissionCents = Math.floor(
      Math.min(profitCents, 1000) * 0.1 +
      Math.max(profitCents - 1000, 0) * 0.2 + 0.5,
    );
    const penaltyCents = Math.min(
      1000,
      Math.floor(valueCents * 0.2 + 0.5),
    );
    const creditCents = valueCents - penaltyCents - commissionCents;

    const result = await service.sell('2');

    expect(result).toMatchObject({
      type: 'VENDA',
      player_id: 2,
      value: valueCents / 100,
      fee: commissionCents / 100,
      penalty: penaltyCents / 100,
      profit: profitCents / 100,
      cash_change: creditCents / 100,
      club_cash: (17949 + creditCents) / 100,
      contract_status: 'RESCINDIDO',
      penalty_rate: 20,
    });
    expect(tx.escalacao.deleteMany).toHaveBeenCalled();
    expect(tx.jogador.updateMany).toHaveBeenCalled();
    expect(tx.contrato.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ situacao: 'RESCINDIDO' }),
      }),
    );
    expect(tx.transacao.create).toHaveBeenCalled();
  });

  it('rounds remaining loyalty days up when more than 30 days remain', async () => {
    const valueCents = playerValueCents();

    const { tx } = setupSell({
      loyaltyMs: 30 * DAY_MS + 3 * 60 * 60 * 1000,
      purchaseCents: valueCents,
      cash: '179.49',
    });

    const result = await service.sell('2');

    expect(result).toMatchObject({
      type: 'VENDA',
      penalty_rate: 10,
    });

    expect(tx.transacao.create).toHaveBeenCalled();
  });

  it('ends the contract without a penalty after loyalty expires', async () => {
    const valueCents = playerValueCents();
    const { tx } = setupSell({
      loyaltyDays: -1,
      purchaseCents: valueCents,
      cash: '179.49',
    });

    const result = await service.sell('2');

    expect(result).toMatchObject({
      type: 'VENDA',
      penalty: 0,
      fee: 0,
      profit: 0,
      cash_change: valueCents / 100,
      club_cash: (17949 + valueCents) / 100,
      contract_status: 'ENCERRADO',
      penalty_rate: 0,
    });
    expect(tx.contrato.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ situacao: 'ENCERRADO' }),
      }),
    );
  });

  // Histórico

  it('calculates transaction history totals correctly', async () => {
    prisma.clube.findUnique.mockResolvedValue({ id: 1 });

    prisma.transacao.findMany.mockResolvedValue([
      {
        id: 2,
        clube_id: 1,
        jogador_id: 2,
        nome_jogador: 'Carlos Teste',
        tipo: 'VENDA',
        valor: new Prisma.Decimal('114.77'),
        taxa: new Prisma.Decimal('0.00'),
        multa: new Prisma.Decimal('10.00'),
        lucro: new Prisma.Decimal('0.00'),
        variacao_caixa: new Prisma.Decimal('104.77'),
        criado_em: new Date('2026-10-16T15:14:23.000Z'),
      },
      {
        id: 1,
        clube_id: 1,
        jogador_id: 2,
        nome_jogador: 'Carlos Teste',
        tipo: 'COMPRA',
        valor: new Prisma.Decimal('114.77'),
        taxa: new Prisma.Decimal('5.74'),
        multa: new Prisma.Decimal('0.00'),
        lucro: null,
        variacao_caixa: new Prisma.Decimal('-120.51'),
        criado_em: new Date('2026-10-16T15:11:49.000Z'),
      },
    ]);

    const result = await service.getTransactions('1');

    expect(result.summary).toEqual({
      total_spent: 120.51,
      total_received: 104.77,
      total_fees: 5.74,
      total_penalties: 10,
      total_profit: 0,
    });
    expect(result.data).toHaveLength(2);
  });

  it('rejects duplicate transaction type filters', async () => {
    prisma.clube.findUnique.mockResolvedValue({ id: 1 });

    await expect(
      service.getTransactions('1', 'COMPRA,COMPRA'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transacao.findMany).not.toHaveBeenCalled();
  });

  it('exports the CSV header when there are no matching transactions', async () => {
    prisma.clube.findUnique.mockResolvedValue({ id: 1 });
    prisma.transacao.findMany.mockResolvedValue([]);

    const result = await service.exportTransactions('1', 'VENDA');

    expect(result).toBe(
      'data_hora;tipo;jogador;valor;taxa_ou_comissao;multa;lucro;variacao_caixa\n',
    );
    expect(prisma.transacao.findMany).toHaveBeenCalledWith({
      where: {
        clube_id: 1,
        tipo: { in: ['VENDA'] },
      },
      orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
    });
  });
});