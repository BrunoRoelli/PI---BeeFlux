import {
  inteiroPositivo,
  numeroNaoNegativo,
  dataHoraValida,
  dataHoraFutura,
  dataValidaFormato,
  arredondarMoeda
} from './pedidos.regras';
import type {
  CriarPedidoInput,
  AtualizarItensInput,
  AtualizarStatusInput,
  FiltroPedidos,
  PagamentoInput,
  AgendamentoInput,
  ItemPedidoInput,
  TipoPedido,
  FormaPagamento,
  StatusPedido
} from './pedidos.types';

const FORMAS_PAGAMENTO_VALIDAS: FormaPagamento[] = [
  'DINHEIRO',
  'PIX',
  'CARTAO_DEBITO',
  'CARTAO_CREDITO',
  'OUTRO'
];

const STATUS_PEDIDO_VALIDOS: StatusPedido[] = [
  'PENDENTE',
  'CONFIRMADO',
  'EM_PREPARACAO',
  'PRONTO',
  'CONCLUIDO',
  'CANCELADO'
];

export function validarItens(itens: unknown): ItemPedidoInput[] {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error('O pedido deve conter pelo menos um item.');
  }

  return itens.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Item no índice ${index} inválido.`);
    }

    const { id_produto, quantidade } = item as Record<string, unknown>;

    const idProd = Number(id_produto);
    if (!inteiroPositivo(idProd)) {
      throw new Error(`Item ${index + 1}: ID do produto deve ser um número inteiro positivo.`);
    }

    if (typeof quantidade !== 'number' || !Number.isFinite(quantidade) || quantidade <= 0) {
      throw new Error(`Item ${index + 1}: Quantidade deve ser um número maior que zero.`);
    }

    // A unidade ainda não é conhecida nesta camada. A normalização é feita
    // no service depois de consultar produtos.unidade_medida.
    if (Math.abs(quantidade * 1000 - Math.round(quantidade * 1000)) > 1e-8) {
      throw new Error(`Item ${index + 1}: informe no máximo 3 casas decimais.`);
    }

    return { id_produto: idProd, quantidade };
  });
}

export function regrasDataHoraFutura(dataHora: string): boolean { return dataHoraFutura(dataHora); }

function validarAgendamento(
  agendamento: unknown,
  tipoPedido: TipoPedido,
  taxaEntrega: number
): AgendamentoInput | null {
  if (tipoPedido === 'IMEDIATO') {
    if (agendamento !== undefined && agendamento !== null) {
      throw new Error('Pedidos do tipo IMEDIATO não aceitam dados de agendamento.');
    }
    if (taxaEntrega > 0) {
      throw new Error('Pedidos do tipo IMEDIATO não possuem taxa de entrega.');
    }
    return null;
  }

  if (!agendamento || typeof agendamento !== 'object') {
    throw new Error('Pedidos do tipo AGENDADO exigem informações de agendamento.');
  }

  const { tipo_atendimento, data_hora_agendada, endereco_entrega, observacao } =
    agendamento as Record<string, unknown>;

  if (tipo_atendimento !== 'RETIRADA' && tipo_atendimento !== 'ENTREGA') {
    throw new Error('Tipo de atendimento do agendamento deve ser RETIRADA ou ENTREGA.');
  }

  if (typeof data_hora_agendada !== 'string' || !dataHoraValida(data_hora_agendada)) {
    throw new Error('Data e horário de agendamento inválidos. Informe uma data/hora válida.');
  }

  if (!regrasDataHoraFutura(data_hora_agendada)) {
    throw new Error('Não é permitido criar agendamento em data ou horário passado.');
  }

  if (tipo_atendimento === 'RETIRADA') {
    if (taxaEntrega > 0) {
      throw new Error('A taxa de entrega deve ser zero quando o atendimento for RETIRADA.');
    }
  }

  if (tipo_atendimento === 'ENTREGA') {
    if (typeof endereco_entrega !== 'string' || endereco_entrega.trim() === '') {
      throw new Error('Endereço de entrega é obrigatório para atendimento por ENTREGA.');
    }
  }

  return {
    tipo_atendimento,
    data_hora_agendada,
    endereco_entrega:
      typeof endereco_entrega === 'string' && endereco_entrega.trim() !== ''
        ? endereco_entrega.trim()
        : null,
    observacao:
      typeof observacao === 'string' && observacao.trim() !== '' ? observacao.trim() : null
  };
}

export function validarPagamento(pagamento: unknown): PagamentoInput | null {
  if (pagamento === undefined || pagamento === null) return null;

  if (typeof pagamento !== 'object') {
    throw new Error('Dados de pagamento inválidos.');
  }

  const { valor_pagamento, forma_pagamento } = pagamento as Record<string, unknown>;

  if (typeof valor_pagamento !== 'number' || !Number.isFinite(valor_pagamento) || valor_pagamento <= 0) {
    throw new Error('Valor do pagamento deve ser um número maior que zero.');
  }

  if (!FORMAS_PAGAMENTO_VALIDAS.includes(forma_pagamento as FormaPagamento)) {
    throw new Error(`Forma de pagamento inválida. Opções aceitas: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')}.`);
  }

  return {
    valor_pagamento: arredondarMoeda(valor_pagamento),
    forma_pagamento: forma_pagamento as FormaPagamento
  };
}

export function validarCriarPedido(dados: unknown): CriarPedidoInput {
  if (!dados || typeof dados !== 'object') {
    throw new Error('Corpo da requisição deve ser um objeto JSON válido.');
  }

  const {
    id_cliente,
    tipo_pedido,
    observacao,
    taxa_entrega,
    itens,
    agendamento,
    pagamento,
    id_user
  } = dados as Record<string, unknown>;

  const userId = Number(id_user);
  if (!inteiroPositivo(userId)) {
    throw new Error('Identificação do usuário (id_user) é obrigatória para registrar a operação.');
  }

  if (tipo_pedido !== 'IMEDIATO' && tipo_pedido !== 'AGENDADO') {
    throw new Error('Tipo de pedido inválido. Deve ser IMEDIATO ou AGENDADO.');
  }

  const clienteId = id_cliente !== undefined && id_cliente !== null ? Number(id_cliente) : null;
  if (tipo_pedido === 'AGENDADO') {
    if (!inteiroPositivo(clienteId)) {
      throw new Error('Pedidos do tipo AGENDADO exigem um cliente cadastrado vinculado (id_cliente).');
    }
  } else if (clienteId !== null && !inteiroPositivo(clienteId)) {
    throw new Error('ID do cliente informado é inválido.');
  }

  const taxa = taxa_entrega !== undefined && taxa_entrega !== null ? Number(taxa_entrega) : 0;
  if (!numeroNaoNegativo(taxa)) {
    throw new Error('Taxa de entrega não pode ser negativa ou inválida.');
  }

  const itensValidados = validarItens(itens);
  const agendamentoValidado = validarAgendamento(agendamento, tipo_pedido, taxa);
  const pagamentoValidado = validarPagamento(pagamento);

  return {
    id_cliente: clienteId,
    tipo_pedido,
    observacao: typeof observacao === 'string' && observacao.trim() !== '' ? observacao.trim() : null,
    taxa_entrega: arredondarMoeda(taxa),
    itens: itensValidados,
    agendamento: agendamentoValidado,
    pagamento: pagamentoValidado,
    id_user: userId
  };
}

export function validarAtualizarItens(dados: unknown): AtualizarItensInput {
  if (!dados || typeof dados !== 'object') {
    throw new Error('Corpo da requisição deve ser um objeto JSON válido.');
  }

  const { itens, taxa_entrega, observacao, id_user } = dados as Record<string, unknown>;

  const userId = Number(id_user);
  if (!inteiroPositivo(userId)) {
    throw new Error('Identificação do usuário (id_user) é obrigatória.');
  }

  const itensValidados = validarItens(itens);
  const taxa = taxa_entrega !== undefined && taxa_entrega !== null ? Number(taxa_entrega) : undefined;
  if (taxa !== undefined && !numeroNaoNegativo(taxa)) {
    throw new Error('Taxa de entrega não pode ser negativa.');
  }

  return {
    itens: itensValidados,
    taxa_entrega: taxa !== undefined ? arredondarMoeda(taxa) : undefined,
    observacao: typeof observacao === 'string' ? observacao.trim() : undefined,
    id_user: userId
  };
}

export function validarAtualizarStatus(dados: unknown): AtualizarStatusInput {
  if (!dados || typeof dados !== 'object') {
    throw new Error('Corpo da requisição deve ser um objeto JSON válido.');
  }

  const { status_pedido, motivo, id_user } = dados as Record<string, unknown>;

  const userId = Number(id_user);
  if (!inteiroPositivo(userId)) {
    throw new Error('Identificação do usuário (id_user) é obrigatória.');
  }

  if (!STATUS_PEDIDO_VALIDOS.includes(status_pedido as StatusPedido)) {
    throw new Error(`Status de pedido inválido. Opções válidas: ${STATUS_PEDIDO_VALIDOS.join(', ')}.`);
  }

  return {
    status_pedido: status_pedido as StatusPedido,
    motivo: typeof motivo === 'string' && motivo.trim() !== '' ? motivo.trim() : undefined,
    id_user: userId
  };
}

export function validarFiltroPedidos(query: Record<string, unknown>): FiltroPedidos {
  const filtro: FiltroPedidos = {};

  if (query.status !== undefined) {
    if (!STATUS_PEDIDO_VALIDOS.includes(query.status as StatusPedido)) {
      throw new Error(`Filtro de status inválido. Opções: ${STATUS_PEDIDO_VALIDOS.join(', ')}.`);
    }
    filtro.status = query.status as StatusPedido;
  }

  if (query.tipo !== undefined) {
    if (query.tipo !== 'IMEDIATO' && query.tipo !== 'AGENDADO') {
      throw new Error('Filtro de tipo inválido. Opções: IMEDIATO ou AGENDADO.');
    }
    filtro.tipo = query.tipo;
  }

  if (query.id_cliente !== undefined) {
    const idC = Number(query.id_cliente);
    if (!inteiroPositivo(idC)) {
      throw new Error('Filtro id_cliente deve ser um número positivo.');
    }
    filtro.id_cliente = idC;
  }

  if (query.de !== undefined) {
    if (typeof query.de !== 'string' || !dataValidaFormato(query.de)) {
      throw new Error('Filtro de data inicial "de" inválido. Formato esperado: AAAA-MM-DD.');
    }
    filtro.de = query.de;
  }

  if (query.ate !== undefined) {
    if (typeof query.ate !== 'string' || !dataValidaFormato(query.ate)) {
      throw new Error('Filtro de data final "ate" inválido. Formato esperado: AAAA-MM-DD.');
    }
    filtro.ate = query.ate;
  }

  if (filtro.de && filtro.ate && filtro.de > filtro.ate) {
    throw new Error('A data inicial "de" não pode ser posterior à data final "ate".');
  }

  if (typeof query.busca === 'string' && query.busca.trim() !== '') {
    filtro.termo_busca = query.busca.trim();
  }

  if (query.limite !== undefined) {
    const l = Number(query.limite);
    if (!inteiroPositivo(l)) throw new Error('Limite de paginação deve ser um número positivo.');
    filtro.limite = Math.min(l, 100);
  }

  if (query.pagina !== undefined) {
    const p = Number(query.pagina);
    if (!inteiroPositivo(p)) throw new Error('Número de página deve ser um número positivo.');
    filtro.pagina = p;
  }

  return filtro;
}
