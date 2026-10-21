import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Jogador, Prisma } from '@prisma/client';
import { toCents } from '../common/money';
import { compareNames, foldText } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePlayerDto } from './dto/create-player.dto';
import type { CONDITIONS } from './dto/player-fields';
import type { PlayersQuery, SortCriterion } from './dto/query-players';
import type { UpdatePlayerDto } from './dto/update-player.dto';
import {
  POSITION_ORDER,
  marketValueOf,
  overallOf,
  toPlayerResponse,
} from './player.mapper';
import { calculateBaseValue, type Position } from './utils/player-calculations';
import { assertAgilityForAge, assertCreationRules } from './utils/player-rules';

type Condition = (typeof CONDITIONS)[number];
type Entry = { player: Jogador; marketValue: number };

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlayerDto) {
    assertCreationRules(dto, dto.age, dto.agility);

    const overall = overallOf({
      posicao: dto.position,
      idade: dto.age,
      potencial: dto.potential,
      velocidade: dto.pace,
      finalizacao: dto.shooting,
      passe: dto.passing,
      drible: dto.dribbling,
      defesa: dto.defending,
      fisico: dto.physical,
    });

    const player = await this.prisma.jogador.create({
      data: {
        nome: dto.name,
        posicao: dto.position,
        agilidade: dto.agility,
        idade: dto.age,
        velocidade: dto.pace,
        finalizacao: dto.shooting,
        passe: dto.passing,
        drible: dto.dribbling,
        defesa: dto.defending,
        fisico: dto.physical,
        potencial: dto.potential,
        valor_base: calculateBaseValue(overall, dto.age, dto.potential),
        condicao: 'APTO',
      },
    });

    return toPlayerResponse(player);
  }

  async findAll(query: PlayersQuery) {
    if (query.clubId !== undefined) {
      const club = await this.prisma.clube.findUnique({
        where: { id: query.clubId },
        select: { id: true },
      });
      if (!club) throw new NotFoundException('Clube não encontrado.');
    }

    const players = await this.prisma.jogador.findMany({
      where: this.buildWhere(query),
    });

    const entries: Entry[] = players
      .map((player) => ({ player, marketValue: marketValueOf(player) }))
      .filter((entry) => this.matchesSearchAndValue(entry, query));

    entries.sort((a, b) => this.compareEntries(a, b, query.sort));

    const totalItems = entries.length;
    const start = (query.page - 1) * query.limit;

    return {
      data: entries
        .slice(start, start + query.limit)
        .map((entry) => toPlayerResponse(entry.player)),
      meta: {
        page: query.page,
        limit: query.limit,
        total_items: totalItems,
        total_pages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async findOne(id: number) {
    return toPlayerResponse(await this.findActive(id));
  }

  async update(id: number, dto: UpdatePlayerDto) {
    assertAgilityForAge(dto.agility, dto.age);
    const player = await this.findActive(id);

    if (dto.age < player.idade) {
      throw new ConflictException(
        'A idade não pode ser menor que a idade atual.',
      );
    }
    if (player.clube_id !== null && dto.position !== player.posicao) {
      throw new ConflictException(
        'Jogador com clube não pode mudar de posição.',
      );
    }

    const updated = await this.prisma.jogador.update({
      where: { id },
      data: {
        nome: dto.name,
        posicao: dto.position,
        agilidade: dto.agility,
        idade: dto.age,
      },
    });
    return toPlayerResponse(updated);
  }

  async updateCondition(id: number, condition: Condition) {
    return this.prisma.$transaction(async (tx) => {
      const player = await tx.jogador.findFirst({
        where: { id, excluido_em: null },
      });
      if (!player) throw new NotFoundException('Jogador não encontrado.');

      if (player.condicao === condition) return toPlayerResponse(player);

      if (player.condicao === 'DOENTE' && condition === 'APTO') {
        throw new ConflictException(
          'Jogador DOENTE não passa direto para APTO.',
        );
      }

      // DOENTE sai da escalação na mesma operação (RN19).
      if (condition === 'DOENTE') {
        await tx.escalacao.deleteMany({ where: { jogador_id: id } });
      }

      const updated = await tx.jogador.update({
        where: { id },
        data: { condicao: condition },
      });
      return toPlayerResponse(updated);
    });
  }

  /** Exclusão lógica (RN09): só jogador livre. */
  async remove(id: number): Promise<void> {
    const player = await this.findActive(id);
    if (player.clube_id !== null) {
      throw new ConflictException('Só é possível excluir jogador livre.');
    }
    await this.prisma.jogador.update({
      where: { id },
      data: { excluido_em: new Date() },
    });
  }

  private async findActive(id: number): Promise<Jogador> {
    const player = await this.prisma.jogador.findFirst({
      where: { id, excluido_em: null },
    });
    if (!player) throw new NotFoundException('Jogador não encontrado.');
    return player;
  }

  private buildWhere(query: PlayersQuery): Prisma.JogadorWhereInput {
    const where: Prisma.JogadorWhereInput = { excluido_em: null };
    if (query.position) where.posicao = query.position;
    if (query.condition) where.condicao = query.condition;

    if (query.clubId !== undefined) where.clube_id = query.clubId;
    else if (query.free === true) where.clube_id = null;
    else if (query.free === false) where.clube_id = { not: null };

    if (query.minAge !== undefined || query.maxAge !== undefined) {
      where.idade = { gte: query.minAge, lte: query.maxAge };
    }
    return where;
  }

  /** O valor de mercado é calculado na hora, então a faixa de valor e a busca por nome são aplicadas depois da leitura. */
  private matchesSearchAndValue(
    { player, marketValue }: Entry,
    query: PlayersQuery,
  ): boolean {
    if (query.search && !foldText(player.nome).includes(query.search))
      return false;
    const cents = toCents(marketValue);
    if (query.minValue !== undefined && cents < toCents(query.minValue))
      return false;
    if (query.maxValue !== undefined && cents > toCents(query.maxValue))
      return false;
    return true;
  }

  private compareEntries(
    a: Entry,
    b: Entry,
    criteria: SortCriterion[],
  ): number {
    for (const criterion of criteria) {
      const difference = this.compareBy(a, b, criterion);
      if (difference !== 0) return difference;
    }
    return (
      compareNames(a.player.nome, b.player.nome) || a.player.id - b.player.id
    );
  }

  private compareBy(a: Entry, b: Entry, criterion: SortCriterion): number {
    switch (criterion) {
      case 'name':
        return compareNames(a.player.nome, b.player.nome);
      case 'value_asc':
        return toCents(a.marketValue) - toCents(b.marketValue);
      case 'value_desc':
        return toCents(b.marketValue) - toCents(a.marketValue);
      case 'age_asc':
        return a.player.idade - b.player.idade;
      case 'age_desc':
        return b.player.idade - a.player.idade;
      case 'position':
        return (
          POSITION_ORDER[a.player.posicao as Position] -
          POSITION_ORDER[b.player.posicao as Position]
        );
    }
  }
}
