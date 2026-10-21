import { api } from "@/src/services/api";
import type { Condicao, Jogador, Posicao } from "@/src/types";

export type OrdenacaoJogadores = "name" | "age" | "market_value" | "position";

export interface FiltrosJogadores {
  search?: string;
  position?: string;
  condition?: string;
  club_id?: number;
  free?: "true" | "false";
  /** Faixas de idade e de valor de mercado. */
  min_age?: number;
  max_age?: number;
  min_value?: number;
  max_value?: number;
  /** Ordenação (ex.: name, value_desc, value_asc, age_desc, age_asc, position). */
  sort?: string;
  /** Nomes antigos da API (age_min, age_max, sort_by + order), ainda aceitos aqui. */
  age_min?: number;
  age_max?: number;
  sort_by?: OrdenacaoJogadores;
  order?: "asc" | "desc";
  page: number;
  limit: number;
}

export interface PaginaJogadores {
  data: Jogador[];
  meta: { page: number; limit: number; total_items: number; total_pages: number };
}

/** A API pode devolver o total como total_items ou total; aqui vira sempre total_items. */
interface PaginaBruta {
  data: Jogador[];
  meta: {
    page: number;
    limit: number;
    total_items?: number;
    total?: number;
    total_pages: number;
  };
}

export interface DadosJogador {
  name: string;
  position: Posicao;
  agility: number;
  age: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  potential: number;
}

export interface ResultadoCompra {
  player_name: string;
  value: number;
  fee: number;
  club_cash: number;
}

export const POSICOES: Record<Posicao, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LAT: "Lateral",
  MEI: "Meio-campo",
  ATA: "Atacante",
};

export const CONDICOES: Record<
  Condicao,
  { label: string; color: string; bg: string }
> = {
  APTO: { label: "Apto", color: "#087A37", bg: "#E8FFF0" },
  MAL_CONDICIONADO: { label: "Mal condicionado", color: "#9A5700", bg: "#FFF6D9" },
  DOENTE: { label: "Doente", color: "#D21F35", bg: "#FFF0F1" },
};

export const LIMITE_API = 100;

function toQuery(filters: FiltrosJogadores): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export const playersService = {
  list: async (filters: FiltrosJogadores): Promise<PaginaJogadores> => {
    const raw = await api.get<PaginaBruta>(`/players?${toQuery(filters)}`);
    const { total_items, total, ...rest } = raw.meta;
    return { data: raw.data, meta: { ...rest, total_items: total_items ?? total ?? 0 } };
  },

  get: (id: number) => api.get<Jogador>(`/players/${id}`),

  create: (body: DadosJogador) => api.post<Jogador>("/players", body),

  update: (id: number, body: DadosJogador) =>
    api.put<Jogador>(`/players/${id}`, body),

  setCondition: (id: number, condition: Condicao) =>
    api.patch<{ id: number; condition: Condicao }>(`/players/${id}/condition`, {
      condition,
    }),

  remove: (id: number) => api.delete<{ message: string }>(`/players/${id}`),

  buy: (id: number, body: { club_id: number; loyalty_until: string }) =>
    api.post<ResultadoCompra>(`/players/${id}/buy`, body),
};
