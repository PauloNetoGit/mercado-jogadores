import { api } from "@/src/services/api";
import type { Condicao, Formacao, Posicao } from "@/src/types";

export type ResultadoPartida = "MANDANTE" | "VISITANTE" | "EMPATE";

export interface LadoPartida {
  club_id: number;
  club_name: string;
  formation: Formacao;
  goals: number;
}

/** Item de GET /matches e cabeçalho de GET /matches/:id. */
export interface Partida {
  id: number;
  /** ISO em UTC; a tela converte para Brasília. */
  played_at: string;
  home: LadoPartida;
  away: LadoPartida;
  result: ResultadoPartida;
}

export type AtributoDuelo = "shooting" | "passing" | "dribbling" | "defending";

/** Jogador no duelo, com o valor já descontado do efeito da condição (RN20). */
export interface JogadorDuelo {
  player_id: number;
  player_name: string;
  position: Posicao;
  condition: Condicao;
  attribute: AtributoDuelo;
  value: number;
}

export interface Duelo {
  /** 1 a 3: ataques do mandante; 4 a 6: ataques do visitante. */
  order: number;
  attacking_club_id: number;
  attacker: JogadorDuelo;
  defender: JogadorDuelo;
  goal: boolean;
}

export interface PartidaDetalhe extends Partida {
  duels: Duelo[];
}

/** Linha de GET /standings (a API não devolve a sigla: a tela cruza com a lista de clubes). */
export interface LinhaClassificacao {
  position: number;
  club_id: number;
  club_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export const matchesService = {
  /** Da mais recente para a mais antiga; `clubId` traz só as partidas desse clube. */
  list: (clubId?: number) =>
    api.get<Partida[]>(clubId ? `/matches?club_id=${clubId}` : "/matches"),

  get: (id: number | string) => api.get<PartidaDetalhe>(`/matches/${id}`),

  /** POST /matches: o placar sai dos atributos dos titulares (sem sorteio). */
  create: (homeClubId: number, awayClubId: number) =>
    api.post<PartidaDetalhe>("/matches", {
      home_club_id: homeClubId,
      away_club_id: awayClubId,
    }),

  standings: () => api.get<LinhaClassificacao[]>("/standings"),
};
