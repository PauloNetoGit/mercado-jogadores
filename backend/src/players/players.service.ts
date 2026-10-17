import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Position } from '../players/utils/player-calculations';
import {
  calculateOverall,
  calculateBaseValue,
  calculateMarketValue,
} from './utils/player-calculations';

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
    const attributeSum = attributes.reduce(
      (sum, value) => sum + value,
      0,
    );

    if (attributeSum > 480) {
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

    const calculationInput = {
      posicao: dto.position,
      idade: dto.age,
      potencial: dto.potential,
      velocidade: dto.pace,
      finalizacao: dto.shooting,
      passe: dto.passing,
      drible: dto.dribbling,
      defesa: dto.defending,
      fisico: dto.physical,
    };

    const overall = calculateOverall(calculationInput);

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
      select: {
        id: true,
        nome: true,
        posicao: true,
        idade: true,
        agilidade: true,
        velocidade: true,
        finalizacao: true,
        passe: true,
        drible: true,
        defesa: true,
        fisico: true,
        potencial: true,
        valor_base: true,
        condicao: true,
        clube_id: true,
        criado_em: true,
      },
    });

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
      overall,
      base_value: Number(player.valor_base),
      market_value: this.addMarketValue(player),
      condition: player.condicao,
      club_id: player.clube_id,
      created_at: player.criado_em,
    };
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
      throw new BadRequestException(
        'Condição do jogador inválida.',
      );
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
        where: {
          id,
          excluido_em: null,
        },
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

      // Um titular doente precisa sair da escalação na mesma operação
      // em que sua condição é alterada, para não deixar uma escalação inválida.
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

  async findAll(
    page = 1,
    limit = 10,
    query?: {
      search?: string;
      position?: 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';
      age_min?: number;
      age_max?: number;
      condition?: 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';
      sort_by?: string;
      order?: 'asc' | 'desc';
    },
  ) {
    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'page deve ser >= 1 e limit deve estar entre 1 e 100.',
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

    if (query?.position) {
      where.posicao = query.position;
    }

    if (query?.condition) {
      where.condicao = query.condition;
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

    if (query?.search?.trim()) {
      where.nome = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const sortFields: Record<string, string> = {
      name: 'nome',
      age: 'idade',
      base_value: 'valor_base',
      potential: 'potencial',
      created_at: 'criado_em',
    };

    const sortField =
      sortFields[query?.sort_by ?? 'name'] ?? 'nome';

    const order =
      query?.order === 'desc' ? 'desc' : 'asc';

    const [players, total] = await this.prisma.$transaction([
      this.prisma.jogador.findMany({
        where,
        orderBy: [
          { [sortField]: order },
          { id: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.jogador.count({ where }),
    ]);

    return {
      data: players.map((player) => ({
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
      })),
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
      return null;
    }

    const overall = calculateOverall({
      posicao: player.posicao as Position,
      idade: player.idade,
      potencial: player.potencial,
      velocidade: player.velocidade,
      finalizacao: player.finalizacao,
      passe: player.passe,
      drible: player.drible,
      defesa: player.defesa,
      fisico: player.fisico,
    });

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
      overall,
      base_value: Number(player.valor_base),
      market_value: this.addMarketValue(player),
      condition: player.condicao,
      club_id: player.clube_id,
      created_at: player.criado_em,
    };
  }

  async update(id: number, dto: UpdatePlayerDto) {
    const current = await this.prisma.jogador.findFirst({
      where: {
        id,
        excluido_em: null,
      },
    });

    if (!current) {
      throw new NotFoundException('Jogador não encontrado.');
    }

    const name = dto.name.trim().replace(/\s+/g, ' ');

    if (dto.age < current.idade) {
      throw new ConflictException(
        'Não é permitido diminuir a idade do jogador.',
      );
    }

    if (
      current.clube_id !== null &&
      dto.position !== current.posicao
    ) {
      throw new ConflictException(
        'Não é permitido alterar a posição de um jogador vinculado a um clube.',
      );
    }

    const attributes = [
      dto.pace,
      dto.shooting,
      dto.passing,
      dto.dribbling,
      dto.defending,
      dto.physical,
    ];

    const maxAttribute = Math.max(...attributes);
    const attributeSum = attributes.reduce(
      (sum, value) => sum + value,
      0,
    );

    if (attributeSum > 480) {
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

    const player = await this.prisma.jogador.update({
      where: { id },
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
      },
    });

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
      overall,
      base_value: Number(player.valor_base),
      market_value: this.addMarketValue(player),
      condition: player.condicao,
      club_id: player.clube_id,
      created_at: player.criado_em,
    };
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const player = await tx.jogador.findFirst({
        where: {
          id,
          excluido_em: null,
        },
      });

      if (!player) {
        throw new NotFoundException('Jogador não encontrado.');
      }

      if (player.clube_id !== null) {
        throw new ConflictException(
          'Não é permitido excluir um jogador vinculado a um clube. Venda o jogador antes de excluí-lo.',
        );
      }

      // Evita deixar uma referência de escalação apontando para jogador excluído.
      await tx.escalacao.deleteMany({
        where: { jogador_id: id },
      });

      await tx.jogador.update({
        where: { id },
        data: {
          excluido_em: new Date(),
        },
      });

      return {
        message: 'Jogador excluído com sucesso.',
        id,
      };
    });
  }
}