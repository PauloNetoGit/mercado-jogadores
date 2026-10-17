import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateMarketValue, calculateOverall } from '../players/utils/player-calculations';
import { CreateClubDto } from './dto/create-club.dto';
import { ClubSort } from './dto/query-clubs.dto';
import { calculateLoyaltyPenalty } from '../market/utils/loyalty-penalty';

const INITIAL_CASH = 300;
const MAX_CLUBS = 20;
const POSITION_ORDER: Record<string, number> = {
  GOL: 0,
  ZAG: 1,
  LAT: 2,
  MEI: 3,
  ATA: 4,
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function nameKey(value: string): string {
  // Deliberately preserve diacritics: Águias FC and Aguias FC are distinct.
  return normalizeName(value).toLocaleLowerCase('pt-BR');
}

function normalizedLetters(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z]/gi, '').toUpperCase();
}

function validateClubName(name: string): void {
  const words = name.split(' ');
  if (
    name.length < 3 || name.length > 60 ||
    !/^[A-Za-zÀ-ÖØ-öø-ÿ .-]+$/.test(name) ||
    words.length < 2 || words.length > 5 ||
    /[\t\n\r\u0000-\u001F\u007F]/u.test(name)
  ) {
    throw new BadRequestException(
      'name deve ter de 3 a 60 caracteres, 2 a 5 palavras e conter apenas letras, espaços, hífen ou ponto.',
    );
  }
}

function validateAcronym(name: string, acronym: string): void {
  if (!/^[A-Z]{3}$/.test(acronym) || /^([A-Z])\1\1$/.test(acronym)) {
    throw new BadRequestException('acronym deve conter exatamente 3 letras de A a Z, maiúsculas e não repetidas todas iguais.');
  }

  const letters = normalizedLetters(name);
  if (letters.length === 0 || acronym[0] !== letters[0]) {
    throw new BadRequestException('A primeira letra de acronym deve ser a primeira letra do nome do clube.');
  }

  let cursor = 0;
  for (const letter of acronym) {
    const index = letters.indexOf(letter, cursor);
    if (index < 0) {
      throw new BadRequestException('As letras de acronym devem aparecer no nome, na mesma ordem, ignorando acentos e maiúsculas.');
    }
    cursor = index + 1;
  }
}

function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value);
}

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClubDto) {
    if (typeof dto.name !== 'string' || typeof dto.acronym !== 'string') {
      throw new BadRequestException('name e acronym são obrigatórios.');
    }

    if (/[\t\n\r\u0000-\u001F\u007F]/u.test(dto.name)) {
      throw new BadRequestException('name não pode conter caracteres de controle.');
    }

    const name = normalizeName(dto.name);
    const acronym = dto.acronym;
    validateClubName(name);
    validateAcronym(name, acronym);

    try {
      const club = await this.prisma.$transaction(async (tx) => {
        const count = await tx.clube.count();
        if (count >= MAX_CLUBS) {
          throw new ConflictException('A liga já possui o limite de 20 clubes.');
        }

        return tx.clube.create({
          data: {
            nome: name,
            nome_normalizado: nameKey(name),
            sigla: acronym,
            caixa: new Prisma.Decimal(INITIAL_CASH.toFixed(2)),
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return this.toClubSummary(club, 0);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
          throw new ConflictException(target.includes('sigla') ? 'acronym já está cadastrado.' : 'name já está cadastrado.');
        }
        if (error.code === 'P2034') {
          throw new ConflictException('Não foi possível criar o clube devido a uma alteração concorrente. Tente novamente.');
        }
      }
      throw error;
    }
  }

  async findAll(sort: ClubSort = 'name') {
    const clubs = await this.prisma.clube.findMany({
      include: { jogadores: { where: { excluido_em: null } } },
    });

    const summaries = clubs.map((club) => {
      const squadValue = club.jogadores.reduce((sum, player) => sum + this.marketValue(player), 0);
      return this.toClubSummary(club, squadValue);
    });

    summaries.sort((a, b) => {
      if (sort === 'net_worth_asc' && a.net_worth !== b.net_worth) return a.net_worth - b.net_worth;
      if (sort === 'net_worth_desc' && a.net_worth !== b.net_worth) return b.net_worth - a.net_worth;
      return a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id;
    });

    return summaries;
  }

  async findOne(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('id deve ser um inteiro positivo.');
    }

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

    if (!club) throw new NotFoundException(`Clube ${id} não encontrado.`);

    const players = club.jogadores
      .map((player) => {
        const contract = player.contratos[0];
        const marketValue = this.marketValue(player);
        const overall = calculateOverall({
          posicao: player.posicao as 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA',
          idade: player.idade,
          potencial: player.potencial,
          velocidade: player.velocidade,
          finalizacao: player.finalizacao,
          passe: player.passe,
          drible: player.drible,
          defesa: player.defesa,
          fisico: player.fisico,
        });
        const { remainingDays, penaltyRate } = contract
          ? calculateLoyaltyPenalty(contract.fidelidade_ate)
          : { remainingDays: 0, penaltyRate: 0 };

        return {
          id: player.id,
          name: player.nome,
          position: player.posicao,
          agility: player.agilidade,
          age: player.idade,
          condition: player.condicao,
          base_value: toNumber(player.valor_base),
          market_value: marketValue,
          pace: player.velocidade,
          shooting: player.finalizacao,
          passing: player.passe,
          dribbling: player.drible,
          defending: player.defesa,
          physical: player.fisico,
          potential: player.potencial,
          overall,
          club_id: player.clube_id,
          contract: contract ? {
            purchase_value: toNumber(contract.valor_compra),
            loyalty_until: contract.fidelidade_ate.toISOString(),
            remaining_days: remainingDays,
            penalty_rate: penaltyRate,
          } : null,
        };
      })
      .sort((a, b) => (POSITION_ORDER[a.position] - POSITION_ORDER[b.position]) || a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id);

    const squadValue = roundMoney(players.reduce((sum, player) => sum + player.market_value, 0));
    return {
      ...this.toClubSummary(club, squadValue),
      players,
    };
  }

  private marketValue(player: {
    valor_base: Prisma.Decimal;
    condicao: string;
    agilidade: number;
    idade: number;
  }): number {
    return calculateMarketValue(
      toNumber(player.valor_base),
      player.condicao as 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE',
      player.agilidade,
      player.idade,
    );
  }

  private toClubSummary(club: { id: number; nome: string; sigla: string; caixa: Prisma.Decimal | number | string }, squadValue: number) {
    const cash = toNumber(club.caixa);
    const squad = roundMoney(squadValue);
    return {
      id: club.id,
      name: club.nome,
      acronym: club.sigla.trim(),
      cash: roundMoney(cash),
      squad_value: squad,
      net_worth: roundMoney(cash + squad),
    };
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
