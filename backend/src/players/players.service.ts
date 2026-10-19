import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import {
  calculateOverall,
  calculateBaseValue,
  calculateMarketValue,
} from './utils/player-calculations';

import type { Position } from './utils/player-calculations';

// Letras acentuadas (minúsculas e maiúsculas) e o equivalente sem acento.
const ACCENTED = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const PLAIN = 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlayerDto) {
    const name = dto.name.trim().replace(/\s+/g, ' ');

    const attributes = [
      dto.pace,
      dto.shooting,
      dto.passing,
      dto.dribbling,
      dto.defending,
      dto.physical,
    ];

    const maxAttribute = Math.max(...attributes);

    if (attributes.reduce((s, v) => s + v, 0) > 480) {
      throw new BadRequestException(
        'A soma dos atributos não pode ultrapassar 480.',
      );
    }

    if (dto.potential < maxAttribute) {
      throw new BadRequestException(
        'potential deve ser maior ou igual ao maior atributo.',
      );
    }

    if (dto.age >= 33 && dto.potential !== maxAttribute) {
      throw new BadRequestException(
        'Para jogadores com 33 anos ou mais, potential deve ser igual ao maior atributo.',
      );
    }

    if (dto.age >= 35 && dto.agility > 85) {
      throw new BadRequestException(
        'Jogadores com 35 anos ou mais podem ter agility de no máximo 85.',
      );
    }

    const overall = calculateOverall({
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

    const baseValue = calculateBaseValue(
      overall,
      dto.age,
      dto.potential,
    );

    const player = await this.prisma.jogador.create({
      data: {
        nome: name,
        posicao: dto.position,
        idade: dto.age,
        agilidade: dto.agility,
        velocidade: dto.pace,
        finalizacao: dto.shooting,
        passe: dto.passing,
        drible: dto.dribbling,
        defesa: dto.defending,
        fisico: dto.physical,
        potencial: dto.potential,
        valor_base: baseValue,
        condicao: 'APTO',
      },
    });

    return this.findOne(player.id);
  }

  private addMarketValue(player: {
    valor_base: unknown;
    condicao: string;
    agilidade: number;
    idade: number;
  }) {
    if (
      player.condicao !== 'APTO' &&
      player.condicao !== 'MAL_CONDICIONADO' &&
      player.condicao !== 'DOENTE'
    ) {
      throw new BadRequestException('Condição do jogador inválida.');
    }

    return calculateMarketValue(
      Number(player.valor_base),
      player.condicao as 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE',
      player.agilidade,
      player.idade,
    );
  }

  async updateCondition(
    id: number,
    condition: 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const player = await tx.jogador.findFirst({
        where: { id, excluido_em: null },
      });

      if (!player) {
        throw new NotFoundException('Jogador não encontrado.');
      }

      if (
        player.condicao === 'DOENTE' &&
        condition === 'APTO'
      ) {
        throw new ConflictException(
          'Um jogador doente não pode passar diretamente para APTO.',
        );
      }

      if (condition === 'DOENTE') {
        await tx.escalacao.deleteMany({
          where: { jogador_id: id },
        });
      }

      const updated = await tx.jogador.update({
        where: { id },
        data: { condicao: condition },
      });

      return {
        id: updated.id,
        condition: updated.condicao,
      };
    });
  }

  
  /**
   * Ids dos jogadores cujo nome contém o termo, ignorando acentos e caixa.
   * Usa translate() (nativo do PostgreSQL) em vez da extensão unaccent,
   * para não depender de CREATE EXTENSION no banco.
   */
  private async findIdsByName(search: string): Promise<number[]> {
    const term = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[!%_]/g, '!$&');

    const rows = await this.prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT id
      FROM jogadores
      WHERE excluido_em IS NULL
        AND lower(translate(nome, ${ACCENTED}, ${PLAIN})) LIKE ${`%${term}%`} ESCAPE '!'
    `);

    return rows.map((row) => row.id);
  }

  async findAll(
    page = 1,
    limit = 10,
    query?: {
      search?: string;
      position?: 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';
      age_min?: number;
      age_max?: number;
      condition?: 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';
      club_id?: number;
      free?: string;
      sort_by?: string;
      order?: 'asc' | 'desc';
    },
  ) {
    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'page deve ser >=1 e limit entre 1 e 100.',
      );
    }

    if (
      query?.age_min !== undefined &&
      query?.age_max !== undefined &&
      query.age_min > query.age_max
    ) {
      throw new BadRequestException(
        'age_min não pode ser maior que age_max.',
      );
    }

    const where: any = {
      excluido_em: null,
    };

    if (query?.position) where.posicao = query.position;
    if (query?.condition) where.condicao = query.condition;

    if (query?.club_id !== undefined) {
      where.clube_id = query.club_id;
    } else if (query?.free === 'true') {
      where.clube_id = null;
    } else if (query?.free === 'false') {
      where.clube_id = { not: null };
    }

    if (
      query?.age_min !== undefined ||
      query?.age_max !== undefined
    ) {
      where.idade = {};

      if (query.age_min !== undefined) {
        where.idade.gte = query.age_min;
      }

      if (query.age_max !== undefined) {
        where.idade.lte = query.age_max;
      }
    }

    if (query?.search) {
      // Busca sem acento e sem diferenciar maiúsculas: "joa" encontra "João".
      where.id = { in: await this.findIdsByName(query.search) };
    }

    const order = query?.order ?? 'asc';

    // Valor de mercado é calculado em runtime, então precisamos
    // ordenar todos os resultados filtrados antes de paginar.
    if (
      query?.sort_by === 'market_value' ||
      query?.sort_by === 'position'
    ) {
      const allPlayers = await this.prisma.jogador.findMany({
        where,
        orderBy: { id: 'asc' },
      });

      let allData = allPlayers.map((player) => ({
        id: player.id,
        name: player.nome,
        position: player.posicao,
        age: player.idade,
        agility: player.agilidade,
        pace: player.velocidade,
        shooting: player.finalizacao,
        passing: player.passe,
        dribbling: player.drible,
        defending: player.defesa,
        physical: player.fisico,
        potential: player.potencial,
        overall: calculateOverall({
          posicao: player.posicao as Position,
          idade: player.idade,
          potencial: player.potencial,
          velocidade: player.velocidade,
          finalizacao: player.finalizacao,
          passe: player.passe,
          drible: player.drible,
          defesa: player.defesa,
          fisico: player.fisico,
        }),
        base_value: Number(player.valor_base),
        market_value: this.addMarketValue(player),
        condition: player.condicao,
        club_id: player.clube_id,
        created_at: player.criado_em,
      }));

      if (query.sort_by === 'market_value') {
        allData.sort((a, b) => {
          const difference = a.market_value - b.market_value;
          return order === 'asc' ? difference : -difference;
        });
      } else {
        const positionOrder: Record<string, number> = {
          GOL: 1,
          ZAG: 2,
          LAT: 3,
          MEI: 4,
          ATA: 5,
        };

        allData.sort((a, b) => {
          const difference =
            (positionOrder[a.position] ?? 99) -
            (positionOrder[b.position] ?? 99);

          if (difference !== 0) {
            return order === 'asc' ? difference : -difference;
          }

          return a.name.localeCompare(b.name, 'pt-BR');
        });
      }

      const total = allData.length;
      const start = (page - 1) * limit;

      return {
        data: allData.slice(start, start + limit),
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    }

    const players = await this.prisma.jogador.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy:
        query?.sort_by === 'base_value'
          ? { valor_base: order }
          : query?.sort_by === 'age'
            ? { idade: order }
            : query?.sort_by === 'created_at'
              ? { criado_em: order }
              : { nome: order },
    });

    const total = await this.prisma.jogador.count({ where });

    const data = players.map((player) => ({
      id: player.id,
      name: player.nome,
      position: player.posicao,
      age: player.idade,
      agility: player.agilidade,
      pace: player.velocidade,
      shooting: player.finalizacao,
      passing: player.passe,
      dribbling: player.drible,
      defending: player.defesa,
      physical: player.fisico,
      potential: player.potencial,
      overall: calculateOverall({
        posicao: player.posicao as Position,
        idade: player.idade,
        potencial: player.potencial,
        velocidade: player.velocidade,
        finalizacao: player.finalizacao,
        passe: player.passe,
        drible: player.drible,
        defesa: player.defesa,
        fisico: player.fisico,
      }),
      base_value: Number(player.valor_base),
      market_value: this.addMarketValue(player),
      condition: player.condicao,
      club_id: player.clube_id,
      created_at: player.criado_em,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }


  async findOne(id: number) {
    const player = await this.prisma.jogador.findFirst({
      where: {
        id,
        excluido_em: null,
      },
    });

    if (!player) {
      throw new NotFoundException('Jogador não encontrado.');
    }

    return {
      id: player.id,
      name: player.nome,
      position: player.posicao,
      age: player.idade,
      agility: player.agilidade,
      pace: player.velocidade,
      shooting: player.finalizacao,
      passing: player.passe,
      dribbling: player.drible,
      defending: player.defesa,
      physical: player.fisico,
      potential: player.potencial,
      overall: calculateOverall({
        posicao: player.posicao as Position,        
        idade: player.idade,
        potencial: player.potencial,
        velocidade: player.velocidade,
        finalizacao: player.finalizacao,
        passe: player.passe,
        drible: player.drible,
        defesa: player.defesa,
        fisico: player.fisico,
      }),
      base_value: Number(player.valor_base),
      market_value: this.addMarketValue(player),
      condition: player.condicao,
      club_id: player.clube_id,
      created_at: player.criado_em,
    };
  }

  async update(id: number, dto: UpdatePlayerDto) {
    const player = await this.prisma.jogador.findFirst({
      where: { id, excluido_em: null },
    });

    if (!player) {
      throw new NotFoundException('Jogador não encontrado.');
    }

    const updated = await this.prisma.jogador.update({
      where: { id },
      data: {
        nome: dto.name?.trim().replace(/\s+/g, ' '),
        posicao: dto.position,
        idade: dto.age,
        agilidade: dto.agility,
        velocidade: dto.pace,
        finalizacao: dto.shooting,
        passe: dto.passing,
        drible: dto.dribbling,
        defesa: dto.defending,
        fisico: dto.physical,
        potencial: dto.potential,
      },
    });

    return this.findOne(updated.id);
  }

  async remove(id: number) {
    const player = await this.prisma.jogador.findFirst({
      where: { id, excluido_em: null },
    });

    if (!player) {
      throw new NotFoundException('Jogador não encontrado.');
    }

    await this.prisma.jogador.update({
      where: { id },
      data: { excluido_em: new Date() },
    });

    return {
      message: 'Jogador excluído com sucesso.',
    };
  }
}