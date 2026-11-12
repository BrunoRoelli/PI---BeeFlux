import type { TipoPedido, TipoAtendimento } from '../pedidos.types';

export interface AgendamentoCompleto {
  id_pedido: number;
  tipo_pedido: TipoPedido;
  tipo_atendimento: TipoAtendimento;
  data_hora_agendada: string;
  endereco_entrega: string | null;
  observacao: string | null;
  status_pedido?: string;
  id_cliente?: number | null;
  nome_cliente?: string | null;
  telefone_cliente?: string | null;
}

export interface FiltroAgendamentos {
  de?: string;
  ate?: string;
  tipo_atendimento?: TipoAtendimento;
}

export interface AtualizarAgendamentoInput {
  data_hora_agendada?: string;
  tipo_atendimento?: TipoAtendimento;
  endereco_entrega?: string | null;
  observacao?: string | null;
  id_user: number;
}
