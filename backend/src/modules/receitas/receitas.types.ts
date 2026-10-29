export type StatusReceita = 'EM_DESENVOLVIMENTO' | 'ATIVA' | 'INATIVA';

export interface IngredienteReceita {
  id_ingrediente: number;
  quantidade: number;
}

export interface SalvarReceita {
  id_produto_feito: number;
  rendimento_receita: number;
  tempo_preparo_minutos: number;
  instrucoes: string;
  custos_fixos: number;
  custo_mao_obra: number;
  margem_lucro: number; // percentual (ex: 30 = 30%)
  ingredientes: IngredienteReceita[];
}

export interface ReceitaDetalhe extends SalvarReceita {
  status_receita: StatusReceita;
}

export interface CustoReceita {
  custo_ingredientes: number;
  custos_fixos: number;
  custo_mao_obra: number;
  custo_total: number;
  custo_unitario: number;
  preco_sugerido: number;
  ingredientes_sem_custo: number[];
}

export interface IngredienteVerificado {
  id_ingrediente: number;
  nome_produto: string;
  unidade_medida: string;
  quantidade_necessaria: number;
  quantidade_disponivel: number;
  quantidade_faltante: number;
  atende: boolean;
}

export interface VerificacaoDisponibilidadeProducao {
  id_produto_feito: number;
  quantidade_solicitada: number;
  possui_receita_ativa: boolean;
  viavel: boolean;
  ingredientes: IngredienteVerificado[];
}

export interface StatusDisponibilidadeCardapio {
  id_produto: number;
  nome_produto: string;
  tipo_produto: 'REVENDA' | 'FEITO';
  disponivel: boolean;
  status_atendimento: 'PRONTO_ENTREGA' | 'SOB_ENCOMENDA' | 'INDISPONIVEL';
  saldo_pronto: number;
  capacidade_producao_estimada: number;
}
