export type Posicao = 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';
export type Condicao = 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';
export type Formacao = '3-1' | '2-2' | '2-1-1' | '1-2-1';
export type TipoTransacao = 'COMPRA' | 'VENDA';

export interface Contrato {
  purchase_value: number;
  loyalty_until: string;
  status?: string;
  remaining_days?: number;
  penalty_rate?: number;
}

export interface Jogador {
  id: number;
  name: string;
  position: Posicao;
  agility: number;
  age: number;
  condition: Condicao;
  base_value: number;
  market_value: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  potential: number;
  overall: number;
  club_id: number | null;
  contract?: Contrato;
}

export interface Clube {
  id: number;
  name: string;
  acronym: string;
  cash: number;
  squad_value: number;
  net_worth: number;
  players?: Jogador[];
}

export interface RespostaPaginada<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

export interface RespostaErroAPI {
  message: string;
}