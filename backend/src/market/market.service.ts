import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Transacao } from '@prisma/client';
import { formatBrasilia, parseBrasilia } from '../common/brasilia-time';
import {
  decimalFromCents,
  formatMoneyCsv,
  fromCents,
  toCents,
} from '../common/money';
import { marketValueOf } from '../players/player.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { BuyPlayerDto } from './dto/buy-player.dto';
import type { TransactionsFilter } from './dto/transactions-filter';
import {
  commissionCents,
  penaltyCents,
  purchaseFeeCents,
} from './utils/market-calculations';
import { calculateLoyaltyPenalty } from './utils/loyalty-penalty';

const MAX_SQUAD_SIZE = 12;
const MAX_LOYALTY_DAYS = 1_095;
const DAY_MS = 86_400_000;
const CSV_HEADER =
  'data_hora;tipo;jogador;valor;taxa_ou_comissao;multa;lucro;variacao_caixa';

const nullableMoney = (value: Prisma.Decimal | null) =>
  value === null ? null : fromCents(toCents(value));

function toTransactionResponse(transaction: Transacao) {
  return {
    id: transaction.id,
    club_id: transaction.clube_id,
    player_id: transaction.jogador_id,
    player_name: transaction.nome_jogador,
    type: transaction.tipo,
    value: nullableMoney(transaction.valor),
    fee: nullableMoney(transaction.taxa),
    penalty: nullableMoney(transaction.multa),
    profit: nullableMoney(transaction.lucro),
    cash_change: nullableMoney(transaction.variacao_caixa),
    created_at: formatBrasilia(transaction.criado_em),
  };
}

function escapeCsv(value: string): string {
  return /[;"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Fim da fidelidade: formato da RN01, depois do momento da compra e até 1.095 dias depois dele. */
function parseLoyaltyUntil(value: string, now: Date): Date {
  const date = parseBrasilia(value);
  if (!date) {
    throw new BadRequestException(
      'loyalty_until deve ser uma data e hora existente no formato AAAA-MM-DDTHH:MM-03:00.',
    );
  }
  const delta = date.getTime() - now.getTime();
  if (delta <= 0 || delta > MAX_LOYALTY_DAYS * DAY_MS) {
    throw new BadRequestException(
      'loyalty_until deve ser futuro e estar a no máximo 1.095 dias da compra.',
    );
  }
  return date;
}

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async buy(playerId: number, dto: BuyPlayerDto) {
    const now = new Date();
    const loyaltyUntil = parseLoyaltyUntil(dto.loyalty_until, now);

    return this.runSerializable(async (tx) => {
      const player = await tx.jogador.findFirst({
        where: { id: playerId, excluido_em: null },
      });
      if (!player) throw new NotFoundException('Jogador não encontrado.');
      const club = await tx.clube.findUnique({ where: { id: dto.club_id } });
      if (!club) throw new NotFoundException('Clube não encontrado.');

      if (player.clube_id !== null)
        throw new ConflictException('O jogador não está livre.');

      const alreadySold = await tx.transacao.findFirst({
        where: { clube_id: club.id, jogador_id: playerId, tipo: 'VENDA' },
        select: { id: true },
      });
      if (alreadySold)
        throw new ConflictException(
          `O ${club.nome} já vendeu o Lucas Ferraz e não pode comprá-lo de novo.`,
        );

      const squadSize = await tx.jogador.count({
        where: { clube_id: club.id, excluido_em: null },
      });
      if (squadSize >= MAX_SQUAD_SIZE)
        throw new ConflictException(`O elenco do ${club.nome} já tem 12 jogadores, o limite da liga.`);

      const valueCents = toCents(marketValueOf(player));
      const feeCents = purchaseFeeCents(valueCents);
      const costCents = valueCents + feeCents;
      const cashCents = toCents(club.caixa);
      if (costCents * 2 > cashCents) {
        throw new ConflictException(
          `O custo da compra (${formatMoneyCsv(fromCents(costCents))}) passa do limite de 50% do caixa (${formatMoneyCsv(fromCents(cashCents / 2))}).`,
        );
      }

      const claimed = await tx.jogador.updateMany({
        where: { id: playerId, clube_id: null, excluido_em: null },
        data: { clube_id: club.id },
      });
      if (claimed.count !== 1)
        throw new ConflictException('O jogador não está mais livre.');

      await tx.contrato.create({
        data: {
          jogador_id: playerId,
          clube_id: club.id,
          valor_compra: decimalFromCents(valueCents),
          fidelidade_ate: loyaltyUntil,
          situacao: 'ATIVO',
          iniciado_em: now,
        },
      });

      const newCashCents = cashCents - costCents;
      await tx.clube.update({
        where: { id: club.id },
        data: { caixa: decimalFromCents(newCashCents) },
      });
      const transaction = await tx.transacao.create({
        data: {
          clube_id: club.id,
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
        ...toTransactionResponse(transaction),
        contract: {
          purchase_value: fromCents(valueCents),
          loyalty_until: formatBrasilia(loyaltyUntil),
          status: 'ATIVO',
        },
        club_cash: fromCents(newCashCents),
      };
    });
  }

  async sell(playerId: number) {
    return this.runSerializable(async (tx) => {
      const player = await tx.jogador.findFirst({
        where: { id: playerId, excluido_em: null },
      });
      if (!player) throw new NotFoundException('Jogador não encontrado.');
      if (player.clube_id === null)
        throw new ConflictException('Jogador livre não pode ser vendido.');

      const clubId = player.clube_id;
      const contract = await tx.contrato.findFirst({
        where: { jogador_id: playerId, clube_id: clubId, situacao: 'ATIVO' },
        orderBy: { iniciado_em: 'desc' },
      });
      if (!contract)
        throw new ConflictException('O jogador não tem contrato ativo.');

      const now = new Date();
      const valueCents = toCents(marketValueOf(player));
      const { remainingDays, penaltyRate } = calculateLoyaltyPenalty(
        contract.fidelidade_ate,
        now,
      );
      const feeCents = penaltyCents(valueCents, penaltyRate);
      const purchaseCents = toCents(contract.valor_compra);
      const profitCents = valueCents - purchaseCents;
      const commission = commissionCents(profitCents);
      const creditCents = valueCents - feeCents - commission;

      const club = await tx.clube.findUniqueOrThrow({ where: { id: clubId } });
      const newCashCents = toCents(club.caixa) + creditCents;

      await tx.escalacao.deleteMany({ where: { jogador_id: playerId } });
      const released = await tx.jogador.updateMany({
        where: { id: playerId, clube_id: clubId, excluido_em: null },
        data: { clube_id: null },
      });
      if (released.count !== 1)
        throw new ConflictException('Não foi possível liberar o jogador.');

      const contractStatus = feeCents > 0 ? 'RESCINDIDO' : 'ENCERRADO';
      await tx.contrato.update({
        where: { id: contract.id },
        data: { situacao: contractStatus, encerrado_em: now },
      });
      await tx.clube.update({
        where: { id: clubId },
        data: { caixa: decimalFromCents(newCashCents) },
      });
      const transaction = await tx.transacao.create({
        data: {
          clube_id: clubId,
          jogador_id: playerId,
          nome_jogador: player.nome,
          tipo: 'VENDA',
          valor: decimalFromCents(valueCents),
          taxa: decimalFromCents(commission),
          multa: decimalFromCents(feeCents),
          lucro: decimalFromCents(profitCents),
          variacao_caixa: decimalFromCents(creditCents),
          criado_em: now,
        },
      });

      return {
        ...toTransactionResponse(transaction),
        purchase_value: fromCents(purchaseCents),
        remaining_days: remainingDays,
        penalty_rate: penaltyRate,
        contract_status: contractStatus,
        club_cash: fromCents(newCashCents),
      };
    });
  }

  async getTransactions(clubId: number, filter: TransactionsFilter) {
    const transactions = await this.findTransactions(clubId, filter);
    return {
      data: transactions.map(toTransactionResponse),
      summary: this.summarize(transactions),
    };
  }

  async exportTransactions(
    clubId: number,
    filter: TransactionsFilter,
  ): Promise<string> {
    const transactions = await this.findTransactions(clubId, filter);
    const rows = transactions.map((transaction) =>
      [
        formatBrasilia(transaction.criado_em),
        transaction.tipo,
        escapeCsv(transaction.nome_jogador),
        formatMoneyCsv(transaction.valor),
        formatMoneyCsv(transaction.taxa),
        formatMoneyCsv(transaction.multa),
        formatMoneyCsv(transaction.lucro),
        formatMoneyCsv(transaction.variacao_caixa),
      ].join(';'),
    );
    return [CSV_HEADER, ...rows].map((line) => `${line}\n`).join('');
  }

  /** RN17: totais das transações filtradas, somados em centavos. */
  private summarize(transactions: Transacao[]) {
    const sum = (
      items: Transacao[],
      pick: (item: Transacao) => Prisma.Decimal | null,
    ) =>
      fromCents(
        items.reduce((total, item) => total + toCents(pick(item) ?? 0), 0),
      );
    const purchases = transactions.filter((item) => item.tipo === 'COMPRA');
    const sales = transactions.filter((item) => item.tipo === 'VENDA');

    return {
      total_spent: fromCents(
        toCents(sum(purchases, (item) => item.valor)) +
          toCents(sum(purchases, (item) => item.taxa)),
      ),
      total_received: sum(sales, (item) => item.variacao_caixa),
      total_fees: sum(transactions, (item) => item.taxa),
      total_penalties: sum(sales, (item) => item.multa),
      total_profit: sum(sales, (item) => item.lucro),
    };
  }

  private async findTransactions(
    clubId: number,
    filter: TransactionsFilter,
  ): Promise<Transacao[]> {
    const club = await this.prisma.clube.findUnique({
      where: { id: clubId },
      select: { id: true },
    });
    if (!club) throw new NotFoundException('Clube não encontrado.');

    if (filter.playerId !== undefined) {
      const player = await this.prisma.jogador.findFirst({
        where: { id: filter.playerId, excluido_em: null },
        select: { id: true },
      });
      if (!player) throw new NotFoundException('Jogador não encontrado.');
    }

    return this.prisma.transacao.findMany({
      where: {
        clube_id: clubId,
        ...(filter.types ? { tipo: { in: filter.types } } : {}),
        ...(filter.playerId !== undefined
          ? { jogador_id: filter.playerId }
          : {}),
      },
      orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
    });
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'A operação conflitou com outra alteração. Tente de novo.',
        );
      }
      throw error;
    }
  }
}
