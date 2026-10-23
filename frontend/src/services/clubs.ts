import { api } from "@/src/services/api";
import type { Clube, Formacao, Jogador, TipoTransacao } from "@/src/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export type OrdenacaoClubes = "name" | "net_worth_desc" | "net_worth_asc";

export interface JogadorDoClube extends Omit<Jogador, "contract"> {
  /** Contrato ativo; remaining_days e penalty_rate são calculados para uma venda agora. */
  contract?: Jogador["contract"] | null;
}

/** Resposta de POST /players/:id/sell. */
export interface ResultadoVenda {
  player_name: string;
  value: number;
  fee: number;
  penalty: number;
  profit: number | null;
  cash_change: number;
  purchase_value: number;
  remaining_days: number;
  penalty_rate: number;
  club_cash: number;
}

export interface ClubeDetalhe extends Omit<Clube, "players"> {
  players: JogadorDoClube[];
}

export interface ResumoPartida {
  id: number;
  played_at: string;
  home: { club_id: number; club_name: string; goals: number };
  away: { club_id: number; club_name: string; goals: number };
}

export type { TipoTransacao };

/** Item de GET /clubs/:id/transactions (valores do momento da operação). */
export interface Transacao {
  id: number;
  club_id: number;
  player_id: number;
  player_name: string;
  type: TipoTransacao;
  value: number;
  fee: number;
  penalty: number;
  profit: number | null;
  cash_change: number;
  /** AAAA-MM-DDTHH:MM:SS-03:00 */
  created_at: string;
}

export interface ResumoHistorico {
  total_spent: number;
  total_received: number;
  total_fees: number;
  total_penalties: number;
  total_profit: number;
}

export interface HistoricoClube {
  data: Transacao[];
  summary: ResumoHistorico;
}

/** Filtros do histórico: sem `types`, traz compras e vendas. */
export interface FiltroHistorico {
  types?: TipoTransacao[];
  playerId?: number | null;
}

/** Escalação atual reduzida ao que a tela precisa. */
export interface EscalacaoAtual {
  formation: Formacao | null;
  starterIds: number[];
}

function historyQuery(filter: FiltroHistorico = {}) {
  const params: string[] = [];
  if (filter.types && filter.types.length > 0) params.push(`type=${filter.types.join(",")}`);
  if (filter.playerId) params.push(`player_id=${filter.playerId}`);
  return params.length > 0 ? `?${params.join("&")}` : "";
}

/** Chave do aviso exibido na tela do clube logo após o cadastro. */
export const FLASH_KEY = "passe:flash-toast";

export const MAX_CLUBES = 20;
export const CAIXA_INICIAL = 300;
export const LIMITE_ELENCO = 12;
/** Teto da multa de rescisão, em moedas (regra do backend). */
export const TETO_MULTA = 10;

export const clubsService = {
  list: (sort: OrdenacaoClubes = "name") => api.get<Clube[]>(`/clubs?sort=${sort}`),

  get: (id: number | string) => api.get<ClubeDetalhe>(`/clubs/${id}`),

  create: (body: { name: string; acronym: string }) => api.post<Clube>("/clubs", body),

  transactionsCount: async (id: number | string) => {
    const response = await api.get<{ data: unknown[] }>(`/clubs/${id}/transactions`);
    return response.data.length;
  },

  transactions: (id: number | string, filter: FiltroHistorico = {}) =>
    api.get<HistoricoClube>(`/clubs/${id}/transactions${historyQuery(filter)}`),

  /** GET /clubs/:id/transactions/export, com os mesmos filtros da tela. */
  exportTransactions: async (id: number | string, filter: FiltroHistorico = {}) => {
    const response = await fetch(
      `${API_URL}/clubs/${id}/transactions/export${historyQuery(filter)}`,
    );
    if (!response.ok) {
      let message = "Não foi possível exportar o CSV.";
      try {
        const body = await response.json();
        if (body.message) message = body.message;
      } catch {
        // Corpo sem JSON.
      }
      throw new Error(message);
    }
    return response.blob();
  },

  /** GET /clubs/:id/lineup completo, como a API devolve. */
  lineup: (id: number | string) => api.get<unknown>(`/clubs/${id}/lineup`),

  getLineup: async (id: number | string): Promise<EscalacaoAtual> => {
    const response = await api.get<{
      formation: Formacao | null;
      players: { id: number }[];
    }>(`/clubs/${id}/lineup`);
    return {
      formation: response.formation,
      starterIds: response.players.map((player) => player.id),
    };
  },

  saveLineup: (id: number | string, formation: Formacao, playerIds: number[]) =>
    api.put<unknown>(`/clubs/${id}/lineup`, { formation, player_ids: playerIds }),

  /** O jogador está entre os titulares? Falha na consulta conta como "não". */
  isStarter: async (clubId: number | string, playerId: number) => {
    try {
      const lineup = await clubsService.getLineup(clubId);
      return lineup.starterIds.includes(playerId);
    } catch {
      return false;
    }
  },

  sell: (playerId: number) => api.post<ResultadoVenda>(`/players/${playerId}/sell`, {}),

  matches: () => api.get<ResumoPartida[]>("/matches"),

  playersTotal: async () => {
    const response = await api.get<{
      meta: { total?: number; total_items?: number };
    }>("/players?page=1&limit=1");
    return response.meta.total ?? response.meta.total_items ?? 0;
  },
};
