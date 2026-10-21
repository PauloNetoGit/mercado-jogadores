import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Contrato, type Jogador } from '@prisma/client';
import { formatBrasilia } from '../common/brasilia-time';
import { decimalFromCents, fromCents, toCents } from '../common/money';
import { compareNames } from '../common/text';
import { calculateLoyaltyPenalty } from '../market/utils/loyalty-penalty';
import {
  POSITION_ORDER,
  marketValueOf,
  toPlayerResponse,
} from '../players/player.mapper';
import type { Position } from '../players/utils/player-calculations';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateClubDto } from './dto/create-club.dto';
import type { ClubSort } from './dto/query-clubs.dto';
import {
  assertValidAcronym,
  assertValidClubName,
  clubNameKey,
} from './utils/club-rules';

const INITIAL_CASH_CENTS = 30_000;
const MAX_CLUBS = 20;

type ClubRow = {
  id: number;
  nome: string;
  sigla: string;
  caixa: Prisma.Decimal;
};
type SquadMember = Jogador & { contratos: Contrato[] };

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClubDto) {
    assertValidClubName(dto.name);
    assertValidAcronym(dto.name, dto.acronym);

    try {
      const club = await this.prisma.$transaction(
        async (tx) => {
          if ((await tx.clube.count()) >= MAX_CLUBS) {
            throw new ConflictException('A liga já tem o limite de 20 clubes.');
          }
          return tx.clube.create({
            data: {
              nome: dto.name,
              nome_normalizado: clubNameKey(dto.name),
              sigla: dto.acronym,
              caixa: decimalFromCents(INITIAL_CASH_CENTS),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.toSummary(club, 0);
    } catch (error) {
      throw this.translateWriteError(error);
    }
  }

  async findAll(sort: ClubSort) {
    const clubs = await this.prisma.clube.findMany({
      include: { jogadores: { where: { excluido_em: null } } },
    });

    const summaries = clubs.map((club) =>
      this.toSummary(club, this.squadValueCents(club.jogadores)),
    );

    return summaries.sort((a, b) => {
      if (sort === 'net_worth_asc' && a.net_worth !== b.net_worth)
        return a.net_worth - b.net_worth;
      if (sort === 'net_worth_desc' && a.net_worth !== b.net_worth)
        return b.net_worth - a.net_worth;
      return compareNames(a.name, b.name) || a.id - b.id;
    });
  }

  async findOne(id: number) {
    const club = await this.prisma.clube.findUnique({
      where: { id },
      include: {
        jogadores: {
          where: { excluido_em: null },
          include: {
            contratos: {
              where: { situacao: 'ATIVO' },
              orderBy: { iniciado_em: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!club) throw new NotFoundException('Clube não encontrado.');

    const squad = [...club.jogadores].sort(
      (a, b) =>
        POSITION_ORDER[a.posicao as Position] -
          POSITION_ORDER[b.posicao as Position] ||
        compareNames(a.nome, b.nome) ||
        a.id - b.id,
    );

    return {
      ...this.toSummary(club, this.squadValueCents(squad)),
      players: squad.map((player) => ({
        ...toPlayerResponse(player),
        contract: this.toContract(player),
      })),
    };
  }

  private toContract(player: SquadMember) {
    const contract = player.contratos[0];
    if (!contract) return null;
    const { remainingDays, penaltyRate } = calculateLoyaltyPenalty(
      contract.fidelidade_ate,
    );
    return {
      purchase_value: Number(contract.valor_compra),
      loyalty_until: formatBrasilia(contract.fidelidade_ate),
      remaining_days: remainingDays,
      penalty_rate: penaltyRate,
    };
  }

  private squadValueCents(players: Jogador[]): number {
    return players.reduce(
      (sum, player) => sum + toCents(marketValueOf(player)),
      0,
    );
  }

  private toSummary(club: ClubRow, squadValueCents: number) {
    const cashCents = toCents(club.caixa);
    return {
      id: club.id,
      name: club.nome,
      acronym: club.sigla,
      cash: fromCents(cashCents),
      squad_value: fromCents(squadValueCents),
      net_worth: fromCents(cashCents + squadValueCents),
    };
  }

  private translateWriteError(error: unknown): unknown {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
    if (error.code === 'P2002') {
      const target = JSON.stringify(error.meta?.target ?? '');
      return new ConflictException(
        target.includes('sigla')
          ? 'Já existe um clube com essa sigla.'
          : 'Já existe um clube com esse nome.',
      );
    }
    if (error.code === 'P2034') {
      return new ConflictException(
        'Conflito com outra alteração. Tente de novo.',
      );
    }
    return error;
  }
}
