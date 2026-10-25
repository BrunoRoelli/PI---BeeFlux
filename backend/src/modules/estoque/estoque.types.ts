export interface Estoque {
  id_estoque: number;
  id_produto: number;
  quantidade: number;
  estoque_minimo: number;
  data_atualizacao: Date;
}

export type TipoProduto = 'INGREDIENTE' | 'REVENDA' | 'FEITO';
export type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'PERDA' | 'AJUSTE';

export interface ProdutoEstoque {
  id_produto: number;
  nome_produto: string;
  tipo_produto: TipoProduto;
  unidade_medida: string;
  estoque_minimo: number;
  saldo_atual: number;
  alerta_minimo: boolean;
}

export interface CadastroProduto {
  nome_produto: string;
  tipo_produto: TipoProduto;
  unidade_medida: string;
  preco_produto?: number;
  estoque_minimo?: number;
  descricao_produto?: string | null;
  marca?: string | null;
  id_categoria?: number | null;
}

export interface NovoLote {
  id_produto: number;
  quantidade: number;
  codigo_lote?: string | null;
  data_validade?: string | null; // AAAA-MM-DD
}

export interface MovimentoEstoque {
  id_lote: number;
  tipo_movimentacao: TipoMovimentacao;
  quantidade: number; // positiva para entrada/saída/perda; ajuste = delta com sinal
  motivo?: string;
  confirmado?: boolean;
  confirmar_vencido?: boolean;
  id_user?: number;
}
