export type TipoMovimentacaoFinanceira = 'ENTRADA' | 'SAIDA';

export type CategoriaDespesa =
  | 'ALUGUEL'
  | 'ENERGIA'
  | 'AGUA'
  | 'INTERNET'
  | 'MANUTENCAO'
  | 'EMBALAGEM'
  | 'MAO_DE_OBRA'
  | 'OUTRO';

export type StatusDespesa = 'PENDENTE' | 'PAGO';

export interface FiltroFinanceiro {
  de?: string;
  ate?: string;
  tipo?: TipoMovimentacaoFinanceira;
  categoria?: string;
}

export interface CriarDespesaInput {
  descricao_despesa: string;
  categoria_despesa: CategoriaDespesa;
  valor_despesa: number;
  data_despesa: string;
  data_vencimento?: string | null;
  observacao?: string | null;
}

export interface AtualizarDespesaInput {
  descricao_despesa?: string;
  categoria_despesa?: CategoriaDespesa;
  valor_despesa?: number;
  data_despesa?: string;
  data_vencimento?: string | null;
  observacao?: string | null;
}

export interface CriarRetiradaInput {
  id_user: number;
  valor_retirada: number;
  descricao_retirada?: string | null;
  data_retirada?: string;
}

export interface MovimentacaoFinanceira {
  data_mov: string;
  tipo: TipoMovimentacaoFinanceira;
  categoria: string;
  valor: number;
  origem: string;
  id_referencia: number;
  id_pedido: number | null;
}
