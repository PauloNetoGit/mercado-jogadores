import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateMarketValue } from '../players/utils/player-calculations';
import { BuyPlayerDto } from './dto/buy-player.dto';
import { calculateLoyaltyPenalty } from './utils/loyalty-penalty';

const MAX_ID = 2_147_483_647;
const DAY_MS = 86_400_000;
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
const CSV_HEADER = 'data_hora;tipo;jogador;valor;taxa_ou_comissao;multa;lucro;variacao_caixa';

type TransactionType = 'COMPRA' | 'VENDA';

function parsePathId(raw: string, label: string): number {
  if (!/^[1-9]\d*$/.test(raw)) throw new NotFoundException(`${label} não encontrado.`);
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id > MAX_ID) throw new NotFoundException(`${label} não encontrado.`);
  return id;
}

function parsePositiveQueryId(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(raw)) throw new BadRequestException('player_id deve ser um inteiro positivo.');
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id > MAX_ID) throw new BadRequestException('player_id inválido.');
  return id;
}

function roundCents(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

function decimalFromCents(cents: number): Prisma.Decimal {
  return new Prisma.Decimal((cents / 100).toFixed(2));
}

function money(value: Prisma.Decimal | number | string | null): number | null {
  return value === null ? null : Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatBrasilia(date: Date): string {
  const local = new Date(date.getTime() - BRASILIA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}-03:00`;
}

function parseLoyaltyDate(value: string, now: Date): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}-03:00$/.test(value)) {
    throw new BadRequestException('loyalty_until deve usar o formato AAAA-MM-DDTHH:MM-03:00.');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('loyalty_until não é uma data válida.');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})-03:00$/.exec(value)!;
  const [, y, mo, d, h, mi] = match;
  const local = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)));
  if (
    local.getUTCFullYear() !== Number(y) || local.getUTCMonth() + 1 !== Number(mo) ||
    local.getUTCDate() !== Number(d) || local.getUTCHours() !== Number(h) || local.getUTCMinutes() !== Number(mi)
  ) throw new BadRequestException('loyalty_until não é uma data e hora existente.');

  const delta = date.getTime() - now.getTime();
  if (delta <= 0 || delta > 1_095 * DAY_MS) {
    throw new BadRequestException('loyalty_until deve ser futuro e estar a no máximo 1.095 dias da compra.');
  }
  return date;
}

function marketValue(player: {
  valor_base: Prisma.Decimal;
  condicao: string;
  agilidade: number;
  idade: number;
}): number {
  return calculateMarketValue(
    Number(player.valor_base),
    player.condicao as 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE',
    player.agilidade,
    player.idade,
  );
}

function mapTransaction(tx: {
  id: number; clube_id: number; jogador_id: number; nome_jogador: string;
  tipo: string; valor: Prisma.Decimal; taxa: Prisma.Decimal; multa: Prisma.Decimal;
  lucro: Prisma.Decimal | null; variacao_caixa: Prisma.Decimal; criado_em: Date;
}) {
  return {
    id: tx.id,
    club_id: tx.clube_id,
    player_id: tx.jogador_id,
    player_name: tx.nome_jogador,
    type: tx.tipo,
    value: money(tx.valor),
    fee: money(tx.taxa),
    penalty: money(tx.multa),
    profit: money(tx.lucro),
    cash_change: money(tx.variacao_caixa),
    created_at: formatBrasilia(tx.criado_em),
  };
}

function formatMoneyCsv(value: Prisma.Decimal | number | string | null): string {
  if (value === null) return '';
  return Number(value).toFixed(2).replace('.', ',');
}

function escapeCsv(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async buy(rawPlayerId: string, dto: BuyPlayerDto) {
    const playerId = parsePathId(rawPlayerId, 'Jogador');
    const now = new Date();
    const loyaltyUntil = parseLoyaltyDate(dto.loyalty_until, now);
    const clubId = dto.club_id;
    if (!Number.isInteger(clubId) || clubId <= 0 || clubId > MAX_ID) {
      throw new BadRequestException('club_id deve ser um inteiro positivo.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const player = await tx.jogador.findFirst({ where: { id: playerId, excluido_em: null } });
        if (!player) throw new NotFoundException('Jogador não encontrado.');
        const club = await tx.clube.findUnique({ where: { id: clubId } });
        if (!club) throw new NotFoundException('Clube não encontrado.');
        if (player.clube_id !== null) throw new ConflictException('O jogador não está livre.');

        const previousSale = await tx.transacao.findFirst({
          where: { clube_id: clubId, jogador_id: playerId, tipo: 'VENDA' },
          select: { id: true },
        });
        if (previousSale) throw new ConflictException('O clube não pode recomprar um jogador que já vendeu.');

        const squadCount = await tx.jogador.count({ where: { clube_id: clubId, excluido_em: null } });
        if (squadCount >= 12) throw new ConflictException('O clube já possui 12 jogadores.');

        const valueCents = Math.round(marketValue(player) * 100);
        const feeCents = valueCents > 3_000 ? roundCents(valueCents * 0.05) : 0;
        const costCents = valueCents + feeCents;
        const cashCents = Math.round(Number(club.caixa) * 100);
        if (costCents * 2 > cashCents) {
          throw new ConflictException('O custo da compra ultrapassa 50% do caixa atual do clube.');
        }

        const claimed = await tx.jogador.updateMany({
          where: { id: playerId, clube_id: null, excluido_em: null },
          data: { clube_id: clubId },
        });
        if (claimed.count !== 1) throw new ConflictException('O jogador não está mais livre. Tente novamente.');

        await tx.contrato.create({
          data: {
            jogador_id: playerId,
            clube_id: clubId,
            valor_compra: decimalFromCents(valueCents),
            fidelidade_ate: loyaltyUntil,
            situacao: 'ATIVO',
            iniciado_em: now,
          },
        });

        const newCashCents = cashCents - costCents;
        await tx.clube.update({ where: { id: clubId }, data: { caixa: decimalFromCents(newCashCents) } });
        const transaction = await tx.transacao.create({
          data: {
            clube_id: clubId,
            jogador_id: playerId,
            nome_jogador: player.nome,
            tipo: 'COMPRA',
            valor: decimalFromCents(valueCents),
            taxa: decimalFromCents(feeCents),
            multa: decimalFromCents(0),
            lucro: null,
            variacao_caixa: decimalFromCents(-costCents),
            criado_em: now,
          },
        });
        return {
          ...mapTransaction(transaction),
          contract: {
            purchase_value: valueCents / 100,
            loyalty_until: formatBrasilia(loyaltyUntil),
            status: 'ATIVO',
          },
          club_cash: newCashCents / 100,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('A operação conflitou com outra alteração. Tente novamente.');
      }
      throw error;
    }
  }

  async sell(rawPlayerId: string) {
    const playerId = parsePathId(rawPlayerId, 'Jogador');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const player = await tx.jogador.findFirst({ where: { id: playerId, excluido_em: null } });
        if (!player) throw new NotFoundException('Jogador não encontrado.');
        if (player.clube_id === null) throw new ConflictException('Jogador livre não pode ser vendido.');

        const contract = await tx.contrato.findFirst({
          where: { jogador_id: playerId, clube_id: player.clube_id, situacao: 'ATIVO' },
          orderBy: { iniciado_em: 'desc' },
        });
        if (!contract) throw new ConflictException('O jogador não possui contrato ativo válido.');

        const now = new Date();
        const valueCents = Math.round(marketValue(player) * 100);
        const { remainingDays, penaltyRate } = calculateLoyaltyPenalty(
          contract.fidelidade_ate,
          now,
        );
        const penaltyCents = Math.min(1_000, roundCents(valueCents * penaltyRate / 100));
        const purchaseCents = Math.round(Number(contract.valor_compra) * 100);
        const profitCents = valueCents - purchaseCents;
        const commissionCents = profitCents <= 0
          ? 0
          : roundCents(Math.min(profitCents, 1_000) * 0.1 + Math.max(profitCents - 1_000, 0) * 0.2);
        const creditCents = valueCents - penaltyCents - commissionCents;
        const cashCents = Math.round(Number((await tx.clube.findUniqueOrThrow({ where: { id: player.clube_id } })).caixa) * 100);
        const newCashCents = cashCents + creditCents;

        await tx.escalacao.deleteMany({ where: { jogador_id: playerId } });

        const released = await tx.jogador.updateMany({
          where: { id: playerId, clube_id: player.clube_id, excluido_em: null },
          data: { clube_id: null },
        });
        if (released.count !== 1) throw new ConflictException('Não foi possível liberar o jogador. Tente novamente.');

        const contractStatus = penaltyCents > 0 ? 'RESCINDIDO' : 'ENCERRADO';
        await tx.contrato.update({
          where: { id: contract.id },
          data: { situacao: contractStatus, encerrado_em: now },
        });
        await tx.clube.update({ where: { id: player.clube_id }, data: { caixa: decimalFromCents(newCashCents) } });
        const transaction = await tx.transacao.create({
          data: {
            clube_id: player.clube_id,
            jogador_id: playerId,
            nome_jogador: player.nome,
            tipo: 'VENDA',
            valor: decimalFromCents(valueCents),
            taxa: decimalFromCents(commissionCents),
            multa: decimalFromCents(penaltyCents),
            lucro: decimalFromCents(profitCents),
            variacao_caixa: decimalFromCents(creditCents),
            criado_em: now,
          },
        });
        return {
          ...mapTransaction(transaction),
          purchase_value: purchaseCents / 100,
          remaining_days: remainingDays,
          penalty_rate: penaltyRate,
          contract_status: contractStatus,
          club_cash: newCashCents / 100,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('A operação conflitou com outra alteração. Tente novamente.');
      }
      throw error;
    }
  }

  async getTransactions(rawClubId: string, rawType?: string, rawPlayerId?: string) {
    const clubId = parsePathId(rawClubId, 'Clube');
    const { types, playerId } = await this.validateHistoryFilters(clubId, rawType, rawPlayerId);
    const transactions = await this.fetchTransactions(clubId, types, playerId);
    const data = transactions.map(mapTransaction);
    const purchases = transactions.filter((tx) => tx.tipo === 'COMPRA');
    const sales = transactions.filter((tx) => tx.tipo === 'VENDA');
    const sum = (items: typeof transactions, field: 'valor' | 'taxa' | 'multa' | 'variacao_caixa' | 'lucro') =>
      items.reduce((total, item) => total + (item[field] === null ? 0 : Number(item[field])), 0);

    return {
      data,
      summary: {
        total_spent: roundMoney(sum(purchases, 'valor') + sum(purchases, 'taxa')),
        total_received: roundMoney(sum(sales, 'variacao_caixa')),
        total_fees: roundMoney(sum(transactions, 'taxa')),
        total_penalties: roundMoney(sum(sales, 'multa')),
        total_profit: roundMoney(sum(sales, 'lucro')),
      },
    };
  }

  async exportTransactions(rawClubId: string, rawType?: string, rawPlayerId?: string): Promise<string> {
    const clubId = parsePathId(rawClubId, 'Clube');
    const { types, playerId } = await this.validateHistoryFilters(clubId, rawType, rawPlayerId);
    const transactions = await this.fetchTransactions(clubId, types, playerId);
    const rows = transactions.map((tx) => [
      formatBrasilia(tx.criado_em),
      tx.tipo,
      escapeCsv(tx.nome_jogador),
      formatMoneyCsv(tx.valor),
      formatMoneyCsv(tx.taxa),
      formatMoneyCsv(tx.multa),
      formatMoneyCsv(tx.lucro),
      formatMoneyCsv(tx.variacao_caixa),
    ].join(';'));
    return `${CSV_HEADER}\n${rows.length ? `${rows.join('\n')}\n` : ''}`;
  }

  private async validateHistoryFilters(clubId: number, rawType?: string, rawPlayerId?: string) {
    const club = await this.prisma.clube.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) throw new NotFoundException('Clube não encontrado.');

    let types: TransactionType[] | undefined;
    if (rawType !== undefined) {
      const parts = rawType.split(',');
      if (!rawType || parts.some((part) => part !== 'COMPRA' && part !== 'VENDA') || new Set(parts).size !== parts.length) {
        throw new BadRequestException('type deve conter COMPRA e/ou VENDA, separados por vírgula, sem espaços nem repetição.');
      }
      types = parts as TransactionType[];
    }

    const playerId = parsePositiveQueryId(rawPlayerId);
    if (playerId !== undefined) {
      const player = await this.prisma.jogador.findFirst({ where: { id: playerId, excluido_em: null }, select: { id: true } });
      if (!player) throw new NotFoundException('Jogador não encontrado.');
    }
    return { types, playerId };
  }

  private fetchTransactions(clubId: number, types?: TransactionType[], playerId?: number) {
    return this.prisma.transacao.findMany({
      where: {
        clube_id: clubId,
        ...(types ? { tipo: { in: types } } : {}),
        ...(playerId !== undefined ? { jogador_id: playerId } : {}),
      },
      orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
    });
  }
}

function roundMoney(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) * 100 + 0.5) / 100;
}
