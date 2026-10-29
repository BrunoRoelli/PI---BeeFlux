export type TipoProduto = 'INGREDIENTE' | 'REVENDA' | 'FEITO';
export type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'PERDA' | 'AJUSTE';
export type StatusReserva = 'ATIVA' | 'CONSUMIDA' | 'LIBERADA';
export type StatusPendencia = 'ABERTA' | 'RESOLVIDA' | 'CANCELADA';
export type StatusProducao = 'PLANEJADA' | 'EM_ANDAMENTO' | 'PARCIAL' | 'CONCLUIDA' | 'CANCELADA';

export interface ProdutoEstoque {
  id_produto: number;
  nome_produto: string;
  tipo_produto: TipoProduto;
  unidade_medida: string;
  estoque_minimo: number;
  saldo_atual: number;      // Lotes vigentes ou saldo atual de FEITO
  saldo_fisico: number;     // Todos os lotes (inclusive vencidos) ou FEITO
  saldo_disponivel: number; // Saldo valido descontando reservas ativas
  alerta_minimo: boolean;
  alerta_excesso: boolean;
  controla_estoque: boolean;
}

export interface Produto {
  id_produto: number;
  id_categoria: number | null;
  nome_produto: string;
  descricao_produto: string | null;
  marca: string | null;
  tipo_produto: TipoProduto;
  unidade_medida: string;
  preco_produto: number;
  estoque_minimo: number;
  ativo: boolean;
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

export interface EdicaoProduto {
  nome_produto?: string;
  unidade_medida?: string;
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
  id_item_compra?: number | null;
}

export interface MovimentoEstoque {
  id_lote: number;
  tipo_movimentacao: TipoMovimentacao;
  quantidade: number;
  motivo?: string;
  confirmar_vencido?: boolean;
  id_user?: number;
}

export interface FiltroMovimentacao {
  id_produto?: number;
  tipo?: TipoMovimentacao;
  de?: string;
  ate?: string;
  limite?: number;
  pagina?: number;
}

export interface NecessidadeCompra {
  id_produto: number;
  nome_produto: string;
  tipo_produto: TipoProduto;
  unidade_medida: string;
  saldo_atual: number;
  estoque_minimo: number;
  quantidade_em_compra: number;
  quantidade_comprar: number;
}

export interface ItemRecebimento {
  id_item_compra: number;
  data_validade?: string | null;
  codigo_lote?: string | null;
}

export interface RecebimentoCompra {
  id_compra: number;
  itens?: ItemRecebimento[];
  id_user?: number;
}

export interface RegistroProducaoFeito {
  id_produto_feito: number;
  id_pedido: number;
  quantidade_produzida: number; // Unidades boas entregues
  quantidade_perdida?: number;   // Refugo / descarte durante preparo
  confirmar_vencidos?: boolean;
  id_user?: number;
}

export interface BaixaFeito {
  id_pedido: number;
  id_produto_feito: number;
  quantidade: number;
  id_user?: number;
}

export interface ReservaEstoqueInput {
  id_pedido: number;
  id_produto: number;
  quantidade: number;
}

export interface UsoLote {
  id_lote: number;
  quantidade: number;
  saldo_restante: number;
}
