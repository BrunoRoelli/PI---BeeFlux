import * as repo from './agendamentos.repository';
import * as pedidoRepo from '../pedidos.repository';
import * as pedidoService from '../pedidos.service';
import * as regras from '../pedidos.regras';
import type { FiltroAgendamentos, AtualizarAgendamentoInput } from './agendamentos.types';

export async function listarAgendamentos(filtro: FiltroAgendamentos) {
  return await repo.listarAgendamentosRepo(filtro);
}

export async function obterAgendamentoPorId(idPedido: number) {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido/agendamento inválido.');
  }
  const agendamento = await pedidoRepo.executarTransacao(async (c) => {
    return await repo.buscarAgendamentoPorId(c, idPedido);
  });
  if (!agendamento) {
    throw new Error('Agendamento não encontrado.');
  }
  return agendamento;
}

export async function atualizarAgendamento(idPedido: number, dados: AtualizarAgendamentoInput) {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido/agendamento inválido.');
  }
  if (dados.data_hora_agendada !== undefined) {
    if (!regras.dataHoraValida(dados.data_hora_agendada)) {
      throw new Error('Nova data e horário de agendamento inválidos.');
    }
    if (!regras.dataHoraFutura(dados.data_hora_agendada)) {
      throw new Error('Não é permitido reagendar para uma data ou horário passado.');
    }
  }
  if (dados.tipo_atendimento !== undefined && !['RETIRADA', 'ENTREGA'].includes(dados.tipo_atendimento)) {
    throw new Error('Tipo de atendimento deve ser RETIRADA ou ENTREGA.');
  }
  if (dados.observacao !== undefined && dados.observacao !== null && typeof dados.observacao !== 'string') {
    throw new Error('Observação do agendamento inválida.');
  }
  if (dados.endereco_entrega !== undefined && dados.endereco_entrega !== null
      && typeof dados.endereco_entrega !== 'string') {
    throw new Error('Endereço de entrega inválido.');
  }

  return await pedidoRepo.executarTransacao(async (conn) => {
    const usuario = await pedidoRepo.buscarUsuarioAtivo(conn, dados.id_user);
    if (!usuario) throw new Error('Usuário inválido ou inativo.');

    const agendamentoAtual = await repo.buscarAgendamentoPorId(conn, idPedido);
    if (!agendamentoAtual) throw new Error('Agendamento não encontrado.');

    const pedido = await pedidoRepo.buscarPedidoPorIdBloqueado(conn, idPedido);
    if (!pedido) throw new Error('Pedido associado não encontrado.');

    if (pedido.status_pedido === 'CONCLUIDO' || pedido.status_pedido === 'CANCELADO') {
      throw new Error(`Não é possível alterar agendamento de um pedido com status ${pedido.status_pedido}.`);
    }

    if (dados.tipo_atendimento === 'RETIRADA' && Number(pedido.taxa_entrega) > 0) {
      throw new Error('Para alterar para RETIRADA, primeiro zere a taxa de entrega no pedido.');
    }

    if (dados.tipo_atendimento === 'ENTREGA') {
      const endereco = dados.endereco_entrega ?? agendamentoAtual.endereco_entrega;
      if (!endereco || endereco.trim() === '') {
        throw new Error('Endereço de entrega é obrigatório para atendimento por ENTREGA.');
      }
    }

    if (dados.data_hora_agendada && dados.data_hora_agendada !== agendamentoAtual.data_hora_agendada) {
      const conflito = await repo.verificarConflitoHorario(conn, dados.data_hora_agendada, idPedido);
      if (conflito) {
        throw new Error('Conflito de horários: já existe outro agendamento neste exato horário.');
      }
    }

 const camposAtualizacao: {
      data_hora_agendada?: string;
      tipo_atendimento?: any;
      endereco_entrega?: string | null;
      observacao?: string | null;
    } = {};

    if (dados.data_hora_agendada !== undefined) camposAtualizacao.data_hora_agendada = dados.data_hora_agendada;
    if (dados.tipo_atendimento !== undefined) camposAtualizacao.tipo_atendimento = dados.tipo_atendimento;
    if (dados.endereco_entrega !== undefined) camposAtualizacao.endereco_entrega = dados.endereco_entrega;
    if (dados.observacao !== undefined) camposAtualizacao.observacao = dados.observacao;

    await repo.atualizarAgendamentoRepo(conn, idPedido, camposAtualizacao);

    await pedidoRepo.registrarHistorico(conn, {
      id_pedido: idPedido,
      tipo_evento: 'OUTRO',
      descricao_historico: `Agendamento alterado por ${usuario.nome_user}.`
    });

    return { mensagem: 'Agendamento atualizado com sucesso.' };
  }, dados.data_hora_agendada);
}

// Correção 2: Cancelamento do agendamento chama o cancelamento real e completo do pedido
export async function cancelarAgendamento(idPedido: number, idUser: number) {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido/agendamento inválido.');
  }

  // Delega para o serviço de pedidos, executando o cancelamento real transacional (estoque, pagamento, status, histórico)
  const resultado = await pedidoService.cancelarPedido(idPedido, 'Cancelamento originado pelo módulo de agendamentos.', idUser);
  return {
    mensagem: 'Agendamento e pedido cancelados com sucesso.',
    status_novo: resultado.status_novo
  };
}
