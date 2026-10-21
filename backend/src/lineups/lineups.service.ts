import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Jogador } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { compareNames } from '../common/text';
import { POSITION_ORDER, toPlayerResponse } from '../players/player.mapper';
import {
  FORMATIONS,
  type Formation,
  UpdateLineupDto,
} from './dto/update-lineup.dto';

// A formação conta apenas os quatro jogadores de linha, da defesa para o ataque.
const FORMATION_COUNTS: Record<
  Formation,
  { defense: number; midfield: number; attack: number }
> = {
  '3-1': { defense: 3, midfield: 0, attack: 1 },
  '2-2': { defense: 2, midfield: 0, attack: 2 },
  '2-1-1': { defense: 2, midfield: 1, attack: 1 },
  '1-2-1': { defense: 1, midfield: 2, attack: 1 },
};

@Injectable()
export class LineupsService {
  constructor(private readonly prisma: PrismaService) {}

  async replace(clubId: number, dto: UpdateLineupDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const club = await tx.clube.findUnique({ where: { id: clubId } });
          if (!club) throw new NotFoundException('Clube não encontrado.');

          const players = await tx.jogador.findMany({
            where: { id: { in: dto.player_ids } },
          });
          if (
            players.length !== 5 ||
            players.some((player) => player.excluido_em !== null)
          ) {
            throw new NotFoundException(
              'Um ou mais jogadores não foram encontrados.',
            );
          }

          const byId = new Map(players.map((player) => [player.id, player]));
          const selected = dto.player_ids.map((id) => byId.get(id)!);

          if (selected.some((player) => player.clube_id !== clubId)) {
            throw new ConflictException(
              'Todos os titulares precisam pertencer ao elenco deste clube.',
            );
          }
          if (selected.some((player) => player.condicao === 'DOENTE')) {
            throw new ConflictException(
              'Jogadores DOENTE não podem ser escalados.',
            );
          }
          this.validateFormation(dto.formation, selected);

          // Substitui formação e titulares dentro da mesma transação.
          await tx.escalacao.deleteMany({ where: { clube_id: clubId } });
          await tx.escalacao.createMany({
            data: selected.map((player) => ({
              clube_id: clubId,
              jogador_id: player.id,
            })),
          });
          await tx.clube.update({
            where: { id: clubId },
            data: { formacao: dto.formation },
          });

          return this.buildResponse(clubId, dto.formation, selected);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        throw new ConflictException(
          'A escalação sofreu uma alteração concorrente. Tente novamente.',
        );
      }
      throw error;
    }
  }

  async findCurrent(clubId: number) {
    const club = await this.prisma.clube.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Clube não encontrado.');

    const rows = await this.prisma.escalacao.findMany({
      where: { clube_id: clubId, jogador: { excluido_em: null } },
      include: { jogador: true },
    });
    const players = rows
      .map((row) => row.jogador)
      .sort((a, b) => this.comparePlayers(a, b));
    const formation =
      club.formacao && (FORMATIONS as readonly string[]).includes(club.formacao)
        ? (club.formacao as Formation)
        : null;

    return {
      club_id: clubId,
      formation,
      complete: formation !== null && players.length === 5,
      players: players.map((player) => toPlayerResponse(player)),
    };
  }

  private validateFormation(formation: Formation, players: Jogador[]) {
    const goalkeepers = players.filter(
      (player) => player.posicao === 'GOL',
    ).length;
    const defenders = players.filter(
      (player) => player.posicao === 'ZAG' || player.posicao === 'LAT',
    ).length;
    const midfielders = players.filter(
      (player) => player.posicao === 'MEI',
    ).length;
    const attackers = players.filter(
      (player) => player.posicao === 'ATA',
    ).length;
    const expected = FORMATION_COUNTS[formation];

    if (
      goalkeepers !== 1 ||
      defenders !== expected.defense ||
      midfielders !== expected.midfield ||
      attackers !== expected.attack
    ) {
      throw new ConflictException(
        `As posições dos titulares não correspondem à formação ${formation}.`,
      );
    }
  }

  private buildResponse(
    clubId: number,
    formation: Formation,
    players: Jogador[],
  ) {
    const ordered = [...players].sort((a, b) => this.comparePlayers(a, b));
    return {
      club_id: clubId,
      formation,
      complete: ordered.length === 5,
      players: ordered.map((player) => toPlayerResponse(player)),
    };
  }

  private comparePlayers(a: Jogador, b: Jogador) {
    return (
      POSITION_ORDER[a.posicao as keyof typeof POSITION_ORDER] -
        POSITION_ORDER[b.posicao as keyof typeof POSITION_ORDER] ||
      compareNames(a.nome, b.nome) ||
      a.id - b.id
    );
  }
}
