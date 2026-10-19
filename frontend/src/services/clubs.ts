import { api } from "@/src/services/api";
import type { Clube, Jogador } from "@/src/types";

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

/** Chave do aviso exibido na tela do clube logo após o cadastro. */
export const FLASH_KEY = "passe:flash-toast";

export const MAX_CLUBES = 20;
export const CAIXA_INICIAL = 300;
export const LIMITE_ELENCO = 12;
/** Teto da multa de rescisão, em moedas (regra do backend). */
export const TETO_MULTA = 10;

export const clubsService = {
  list: (sort: OrdenacaoClubes = "name") =>
    api.get<Clube[]>(`/clubs?sort=${sort}`),

  get: (id: number | string) => api.get<ClubeDetalhe>(`/clubs/${id}`),

  create: (body: { name: string; acronym: string }) =>
    api.post<Clube>("/clubs", body),

  transactionsCount: async (id: number | string) => {
    const response = await api.get<{ data: unknown[] }>(
      `/clubs/${id}/transactions`,
    );
    return response.data.length;
  },

  sell: (playerId: number) =>
    api.post<ResultadoVenda>(`/players/${playerId}/sell`, {}),

  matches: () => api.get<ResumoPartida[]>("/matches"),

  playersTotal: async () => {
    const response = await api.get<{
      meta: { total?: number; total_items?: number };
    }>("/players?page=1&limit=1");
    return response.meta.total ?? response.meta.total_items ?? 0;
  },
};
