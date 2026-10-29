export type TipoProdutoCardapio = 'REVENDA' | 'FEITO';
export type StatusDisponibilidade = 'PRONTO_ENTREGA' | 'SOB_ENCOMENDA' | 'INDISPONIVEL';

export interface SalvarCardapio {
  nome_cardapio: string;
  descricao_cardapio?: string | null;
  ativo?: boolean;
}

export interface ItemCardapioVinculo {
  id_produto: number;
  preco_cardapio?: number | null;
  disponivel?: boolean;
  ordem_exibicao?: number;
}

export interface CardapioResumo {
  id_cardapio: number;
  nome_cardapio: string;
  descricao_cardapio: string | null;
  ativo: boolean;
}

export interface ItemCardapioDetalhe {
  id_produto: number;
  nome_produto: string;
  descricao_produto: string | null;
  marca: string | null;
  tipo_produto: TipoProdutoCardapio;
  id_categoria: number | null;
  nome_categoria: string | null;
  preco_padrao: number;
  preco_cardapio: number | null;
  preco_venda: number;
  ativo_cardapio: boolean;
  ordem_exibicao: number;
  // Campos calculados com Estoque e Receita
  status_disponibilidade: StatusDisponibilidade;
  disponivel_para_venda: boolean;
  saldo_pronto: number;
  capacidade_producao_estimada: number;
}

export interface CardapioCompleto extends CardapioResumo {
  produtos: ItemCardapioDetalhe[];
}

export interface FiltroCardapioPublico {
  id_categoria?: number;
  tipo?: TipoProdutoCardapio;
  apenas_disponiveis?: boolean;
}
