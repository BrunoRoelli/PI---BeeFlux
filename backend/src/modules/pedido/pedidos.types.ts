import type { TipoProduto } from '../estoque/estoque.types';

export type TipoPedido = 'IMEDIATO' | 'AGENDADO';

export type StatusPedido =
  | 'PENDENTE'
  | 'CONFIRMADO'
  | 'EM_PREPARACAO'
  | 'PRONTO'
  | 'CONCLUIDO'
  | 'CANCELADO';

export type StatusFinanceiro = 'PENDENTE' | 'PAGO' | 'ESTORNADO';

export type TipoAtendimento = 'RETIRADA' | 'ENTREGA';

export type FormaPagamento =
  | 'DINHEIRO'
  | 'PIX'
  | 'CARTAO_DEBITO'
  | 'CARTAO_CREDITO'
  | 'OUTRO';

export type StatusPagamento = 'PENDENTE' | 'CONFIRMADO' | 'ESTORNADO';

export type TipoEventoHistorico =
  | 'CRIACAO'
  | 'ALTERACAO_ITENS'
  | 'ALTERACAO_VALOR'
  | 'ALTERACAO_STATUS'
  | 'CANCELAMENTO'
  | 'CONCLUSAO'
  | 'EXCLUSAO'
  | 'OUTRO';

/**
 * Entrada de item pelo front-end.
 * O front-end NUNCA envia o preço unitário para evitar manipulação de valores.
 */
export interface ItemPedidoInput {
  id_produto: number;
  quantidade: number;
}

export interface AgendamentoInput {
  tipo_atendimento: TipoAtendimento;
  data_hora_agendada: string; // AAAA-MM-DD HH:mm:ss ou ISO
  endereco_entrega?: string | null;
  observacao?: string | null;
}

export interface PagamentoInput {
  valor_pagamento: number;
  forma_pagamento: FormaPagamento;
}

export interface CriarPedidoInput {
  id_cliente?: number | null;
  tipo_pedido: TipoPedido;
  observacao?: string | null;
  taxa_entrega?: number;
  itens: ItemPedidoInput[];
  agendamento?: AgendamentoInput | null;
  pagamento?: PagamentoInput | null;
  id_user: number; // Obrigatório para trilha de auditoria
}

export interface AtualizarItensInput {
  itens: ItemPedidoInput[];
  taxa_entrega?: number;
  observacao?: string | null;
  id_user: number;
}

export interface AtualizarStatusInput {
  status_pedido: StatusPedido;
  motivo?: string;
  id_user: number;
}

export interface FiltroPedidos {
  status?: StatusPedido;
  tipo?: TipoPedido;
  id_cliente?: number;
  de?: string;
  ate?: string;
  termo_busca?: string; // Busca por número do pedido (#001) ou nome do cliente
  limite?: number;
  pagina?: number;
}

export interface ItemPedidoDetalhe {
  id_item_pedido: number;
  id_pedido: number;
  id_produto: number;
  nome_produto: string;
  tipo_produto: TipoProduto;
  unidade_medida: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export interface AgendamentoDetalhe {
  id_pedido: number;
  tipo_pedido: TipoPedido;
  tipo_atendimento: TipoAtendimento;
  data_hora_agendada: string;
  endereco_entrega: string | null;
  observacao: string | null;
}

export interface PagamentoDetalhe {
  id_pagamento: number;
  id_pedido: number;
  valor_pagamento: number;
  data_pagamento: string;
  forma_pagamento: FormaPagamento;
  status_pagamento: StatusPagamento;
  observacao: string | null;
}

export interface HistoricoPedidoDetalhe {
  id_historico: number;
  id_pedido: number;
  tipo_evento: TipoEventoHistorico;
  status_anterior: string | null;
  status_novo: string | null;
  valor_historico: number | null;
  descricao_historico: string;
  data_historico: string;
}

export interface PedidoCompleto {
  id_pedido: number;
  numero_exibicao: string; // Ex: Pedido #001
  id_cliente: number | null;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  data_pedido: string;
  tipo_pedido: TipoPedido;
  status_pedido: StatusPedido;
  status_financeiro: StatusFinanceiro;
  observacao: string | null;
  taxa_entrega: number;
  valor_itens: number;
  valor_total: number;
  valor_recebido: number;
  valor_em_aberto: number;
  itens: ItemPedidoDetalhe[];
  agendamento: AgendamentoDetalhe | null;
  pagamento: PagamentoDetalhe | null;
  historico: HistoricoPedidoDetalhe[];
}
