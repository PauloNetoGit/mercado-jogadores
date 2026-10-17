import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Jogador } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';

const POSITION_ORDER: Record<string, number> = { GOL: 0, ZAG: 1, LAT: 2, MEI: 3, ATA: 4 };
type PlayerRow = Jogador;
type Side = { clubId: number; players: PlayerRow[] };
type DuelSpec = { order: number; attackingClubId: number; attacker: PlayerRow; defender: PlayerRow };

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMatchDto) {
    this.validateCreate(dto);
    if (dto.home_club_id === dto.away_club_id) {
      throw new BadRequestException('Os clubes mandante e visitante precisam ser diferentes.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const ids = [dto.home_club_id, dto.away_club_id];
        const clubs = await tx.clube.findMany({ where: { id: { in: ids } } });
        if (clubs.length !== 2) throw new NotFoundException('Clube mandante ou visitante não encontrado.');
        const byClubId = new Map(clubs.map((club) => [club.id, club]));
        const homeClub = byClubId.get(dto.home_club_id)!;
        const awayClub = byClubId.get(dto.away_club_id)!;

        const lineupRows = await tx.escalacao.findMany({
          where: { clube_id: { in: ids }, jogador: { excluido_em: null } },
          include: { jogador: true },
        });
        const homePlayers = lineupRows.filter((row) => row.clube_id === homeClub.id).map((row) => row.jogador).sort(comparePlayers);
        const awayPlayers = lineupRows.filter((row) => row.clube_id === awayClub.id).map((row) => row.jogador).sort(comparePlayers);
        if (!homeClub.formacao || homePlayers.length !== 5 || homePlayers.some((player) => player.condicao === 'DOENTE')) {
          throw new ConflictException('O clube mandante precisa ter uma escalação completa e válida.');
        }
        if (!awayClub.formacao || awayPlayers.length !== 5 || awayPlayers.some((player) => player.condicao === 'DOENTE')) {
          throw new ConflictException('O clube visitante precisa ter uma escalação completa e válida.');
        }

        const specs = this.buildDuelSpecs(
          { clubId: homeClub.id, players: homePlayers },
          { clubId: awayClub.id, players: awayPlayers },
        );
        const duels = specs.map((spec) => this.calculateDuel(spec));
        const homeGoals = duels.filter((duel) => duel.attacking_club_id === homeClub.id && duel.goal).length;
        const awayGoals = duels.filter((duel) => duel.attacking_club_id === awayClub.id && duel.goal).length;

        const match = await tx.partida.create({
          data: {
            mandante_id: homeClub.id,
            visitante_id: awayClub.id,
            gols_mandante: homeGoals,
            gols_visitante: awayGoals,
            formacao_mandante: homeClub.formacao,
            formacao_visitante: awayClub.formacao,
            duelos: {
              create: duels.map((duel) => ({
                ordem: duel.order,
                clube_atacante_id: duel.attacking_club_id,
                atacante_id: duel.attacker.player_id,
                defensor_id: duel.defender.player_id,
                nome_atacante: duel.attacker.player_name,
                nome_defensor: duel.defender.player_name,
                posicao_atacante: duel.attacker.position,
                posicao_defensor: duel.defender.position,
                condicao_atacante: duel.attacker.condition,
                condicao_defensor: duel.defender.condition,
                atributo_ataque: duel.attacker.attribute,
                atributo_defesa: duel.defender.attribute,
                valor_ataque: duel.attacker.value,
                valor_defesa: duel.defender.value,
                gol: duel.goal,
              })),
            },
          },
          include: { duelos: { orderBy: { ordem: 'asc' } } },
        });
        return this.toMatchResponse(match, homeClub.nome, awayClub.nome, true);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('A partida encontrou uma alteração concorrente. Tente novamente.');
      }
      throw error;
    }
  }

  async findAll(clubIdParam?: string) {
    let clubId: number | undefined;
    if (clubIdParam !== undefined) {
      if (!/^[1-9]\d*$/.test(clubIdParam) || Number(clubIdParam) > 2147483647) {
        throw new BadRequestException('club_id deve ser um inteiro positivo.');
      }
      clubId = Number(clubIdParam);
      const club = await this.prisma.clube.findUnique({ where: { id: clubId } });
      if (!club) throw new NotFoundException(`Clube ${clubId} não encontrado.`);
    }
    const rows = await this.prisma.partida.findMany({
      where: clubId === undefined ? undefined : { OR: [{ mandante_id: clubId }, { visitante_id: clubId }] },
      include: { mandante: true, visitante: true },
      orderBy: [{ jogada_em: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.toMatchResponse(row, row.mandante.nome, row.visitante.nome, false));
  }

  async findOne(id: number) {
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundException('Partida não encontrada.');
    const match = await this.prisma.partida.findUnique({
      where: { id },
      include: { mandante: true, visitante: true, duelos: { orderBy: { ordem: 'asc' } } },
    });
    if (!match) throw new NotFoundException(`Partida ${id} não encontrada.`);
    return this.toMatchResponse(match, match.mandante.nome, match.visitante.nome, true);
  }

  private validateCreate(dto: CreateMatchDto) {
    if (!dto || !Number.isInteger(dto.home_club_id) || dto.home_club_id <= 0 ||
      !Number.isInteger(dto.away_club_id) || dto.away_club_id <= 0) {
      throw new BadRequestException('home_club_id e away_club_id devem ser inteiros positivos.');
    }
  }

  private buildDuelSpecs(home: Side, away: Side): DuelSpec[] {
    const homeField = home.players.filter((player) => player.posicao !== 'GOL');
    const awayField = away.players.filter((player) => player.posicao !== 'GOL');
    const homeGoalkeeper = home.players.find((player) => player.posicao === 'GOL')!;
    const awayGoalkeeper = away.players.find((player) => player.posicao === 'GOL')!;
    if (homeField.length !== 4 || awayField.length !== 4 || !homeGoalkeeper || !awayGoalkeeper) {
      throw new ConflictException('Ambos os clubes precisam ter uma escalação válida de 1 goleiro e 4 jogadores de linha.');
    }
    const result: DuelSpec[] = [];
    const attacks = [3, 2, 1];
    const defenders = [null, 0, 1] as const;
    attacks.forEach((attackerIndex, index) => {
      result.push({ order: index + 1, attackingClubId: home.clubId, attacker: homeField[attackerIndex], defender: defenders[index] === null ? awayGoalkeeper : awayField[defenders[index]!] });
    });
    attacks.forEach((attackerIndex, index) => {
      result.push({ order: index + 4, attackingClubId: away.clubId, attacker: awayField[attackerIndex], defender: defenders[index] === null ? homeGoalkeeper : homeField[defenders[index]!] });
    });
    return result;
  }

  private calculateDuel(spec: DuelSpec) {
    const attackAttribute = spec.attacker.posicao === 'ATA' ? 'shooting'
      : spec.attacker.posicao === 'MEI' ? 'passing' : 'dribbling';
    const rawAttack = spec.attacker.posicao === 'ATA' ? spec.attacker.finalizacao
      : spec.attacker.posicao === 'MEI' ? spec.attacker.passe : spec.attacker.drible;
    const attackValue = applyCondition(rawAttack, spec.attacker.condicao);
    const defenseValue = applyCondition(spec.defender.defesa, spec.defender.condicao);
    return {
      order: spec.order,
      attacking_club_id: spec.attackingClubId,
      attacker: { player_id: spec.attacker.id, player_name: spec.attacker.nome, position: spec.attacker.posicao, condition: spec.attacker.condicao, attribute: attackAttribute, value: attackValue },
      defender: { player_id: spec.defender.id, player_name: spec.defender.nome, position: spec.defender.posicao, condition: spec.defender.condicao, attribute: 'defending', value: defenseValue },
      goal: attackValue > defenseValue,
    };
  }

  private toMatchResponse(match: any, homeName: string, awayName: string, includeDuels: boolean) {
    const homeGoals = match.gols_mandante;
    const awayGoals = match.gols_visitante;
    const response: Record<string, any> = {
      id: match.id,
      played_at: match.jogada_em,
      home: { club_id: match.mandante_id, club_name: homeName, formation: match.formacao_mandante, goals: homeGoals },
      away: { club_id: match.visitante_id, club_name: awayName, formation: match.formacao_visitante, goals: awayGoals },
      result: homeGoals > awayGoals ? 'MANDANTE' : awayGoals > homeGoals ? 'VISITANTE' : 'EMPATE',
    };
    if (includeDuels) response.duels = (match.duelos ?? []).map((duel: any) => ({
      order: duel.ordem,
      attacking_club_id: duel.clube_atacante_id,
      attacker: { player_id: duel.atacante_id, player_name: duel.nome_atacante, position: duel.posicao_atacante, condition: duel.condicao_atacante, attribute: duel.atributo_ataque, value: duel.valor_ataque },
      defender: { player_id: duel.defensor_id, player_name: duel.nome_defensor, position: duel.posicao_defensor, condition: duel.condicao_defensor, attribute: duel.atributo_defesa, value: duel.valor_defesa },
      goal: duel.gol,
    }));
    return response;
  }
}

function comparePlayers(a: PlayerRow, b: PlayerRow) {
  return (POSITION_ORDER[a.posicao] ?? 99) - (POSITION_ORDER[b.posicao] ?? 99)
    || compareNormalizedNames(a.nome, b.nome) || a.id - b.id;
}

function compareNormalizedNames(a: string, b: string) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function applyCondition(value: number, condition: string) {
  return condition === 'MAL_CONDICIONADO' ? Math.floor(value * 0.85 + 0.5) : value;
}
