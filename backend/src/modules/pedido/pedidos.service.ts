import * as repo from './pedidos.repository';
import * as regras from './pedidos.regras';
import * as agendamentoRepo from '../agendamentos/agendamentos.repository';
import * as estoqueService from '../estoque/estoque.service';
import type {
  CriarPedidoInput,
  AtualizarItensInput,
  AtualizarStatusInput,
  FiltroPedidos,
  PedidoCompleto,
  PagamentoInput
} from './pedidos.types';

export async function listar(filtro: FiltroPedidos) {
  return await repo.listarPedidos(filtro);
}

export async function obterPorId(idPedido: number): Promise<PedidoCompleto> {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido inválido.');
  }
  // Usa repo com transação padrão (sem conn, usa pool)
  const pedido = await repo.buscarPedidoCompleto(idPedido);
  if (!pedido) {
    throw new Error('Pedido não encontrado.');
  }
  return pedido;
}

export async function criarPedido(
  dados: CriarPedidoInput
): Promise<{ id_pedido: number; numero_exibicao: string; valor_total: number }> {
  return await repo.executarTransacao(async (conn) => {
    const usuario = await repo.buscarUsuarioAtivo(conn, dados.id_user);
    if (!usuario) {
      throw new Error(`Usuário ID #${dados.id_user} não encontrado ou está inativo.`);
    }

    if (dados.id_cliente) {
      const cliente = await repo.buscarClientePorId(conn, dados.id_cliente);
      if (!cliente) {
        throw new Error('Cliente informado não foi encontrado.');
      }
      if (!cliente.telefone_cliente || cliente.telefone_cliente.trim() === '') {
        throw new Error('O cliente selecionado precisa ter um telefone válido cadastrado.');
      }
    }

    const itensProcessados: Array<{
      id_produto: number;
      tipo_produto: 'REVENDA' | 'FEITO';
      quantidade: number;
      preco_unitario: number;
      nome_produto: string;
    }> = [];

    for (const item of dados.itens) {
      const prod = await repo.buscarProdutoParaItem(conn, item.id_produto);
      if (!prod || !prod.ativo) {
        throw new Error(`Produto #${item.id_produto} não encontrado ou está inativo no catálogo.`);
      }

      if (prod.tipo_produto === 'INGREDIENTE') {
        throw new Error(
          `O produto "${prod.nome_produto}" é classificado como INGREDIENTE e não pode ser comercializado diretamente no pedido.`
        );
      }

      const quantidadeNormalizada = regras.arredondarQuantidade(item.quantidade, prod.unidade_medida);
      if (quantidadeNormalizada <= 0) {
        throw new Error(`Quantidade inválida para o produto "${prod.nome_produto}".`);
      }
      if (['un', 'und', 'unid', 'unidade', 'unidades', 'pç', 'pc', 'peça', 'peças', 'g', 'gr', 'grama', 'gramas'].includes(prod.unidade_medida.trim().toLowerCase())
          && !Number.isInteger(item.quantidade)) {
        throw new Error(`O produto "${prod.nome_produto}" é vendido por unidade inteira.`);
      }

      const precoOficial = Number(prod.preco_produto);

      itensProcessados.push({
        id_produto: prod.id_produto,
        tipo_produto: prod.tipo_produto as 'REVENDA' | 'FEITO',
        quantidade: quantidadeNormalizada,
        preco_unitario: precoOficial,
        nome_produto: prod.nome_produto
      });
    }

    const { valorItens, valorTotal } = regras.calcularTotaisPedido(
      itensProcessados,
      dados.taxa_entrega ?? 0
    );

    if (dados.pagamento) {
      regras.validarValorPagamento(dados.pagamento.valor_pagamento, valorTotal);
    }

    if (dados.agendamento && dados.agendamento.data_hora_agendada) {
      const conflito = await agendamentoRepo.verificarConflitoHorario(conn, dados.agendamento.data_hora_agendada);
      if (conflito) {
        throw new Error('Conflito de horários: já existe outro agendamento neste exato horário.');
      }
    }

    const idPedido = await repo.inserirPedido(conn, {
      id_cliente: dados.id_cliente ?? null,
      tipo_pedido: dados.tipo_pedido,
      observacao: dados.observacao ?? null,
      taxa_entrega: dados.taxa_entrega ?? 0,
      valor_total: valorTotal
    });

    for (const it of itensProcessados) {
      await repo.inserirItemPedido(conn, {
        id_pedido: idPedido,
        id_produto: it.id_produto,
        tipo_produto: it.tipo_produto,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario
      });
    }

    // Correção 3: Inserção de agendamento usando o repositório de agendamentos
    if (dados.agendamento) {
      await agendamentoRepo.inserirAgendamentoRepo(conn, {
        id_pedido: idPedido,
        tipo_pedido: dados.tipo_pedido,
        tipo_atendimento: dados.agendamento.tipo_atendimento,
        data_hora_agendada: dados.agendamento.data_hora_agendada,
        endereco_entrega: dados.agendamento.endereco_entrega ?? null,
        observacao: dados.agendamento.observacao ?? null
      });
    }

    if (dados.pagamento) {
      await repo.inserirPagamento(conn, {
        id_pedido: idPedido,
        valor_pagamento: dados.pagamento.valor_pagamento,
        forma_pagamento: dados.pagamento.forma_pagamento
      });
    }

    await repo.registrarHistorico(conn, {
      id_pedido: idPedido,
      tipo_evento: 'CRIACAO',
      status_novo: 'PENDENTE',
      valor_historico: valorTotal,
      descricao_historico: `Pedido criado pelo usuário ${usuario.nome_user} com ${itensProcessados.length} item(ns). Valor Itens: R$ ${valorItens.toFixed(2)}, Taxa Entrega: R$ ${(dados.taxa_entrega ?? 0).toFixed(2)}, Total: R$ ${valorTotal.toFixed(2)}.`
    });

    if (dados.pagamento) {
      await repo.registrarHistorico(conn, {
        id_pedido: idPedido,
        tipo_evento: 'ALTERACAO_VALOR',
        valor_historico: dados.pagamento.valor_pagamento,
        descricao_historico: `Pagamento integral de R$ ${dados.pagamento.valor_pagamento.toFixed(2)} confirmado via ${dados.pagamento.forma_pagamento}.`
      });
    }

    return {
      id_pedido: idPedido,
      numero_exibicao: regras.formatarNumeroExibicao(idPedido),
      valor_total: valorTotal
    };
  }, dados.agendamento?.data_hora_agendada);
}

export async function atualizarItensPedido(
  idPedido: number,
  dados: AtualizarItensInput
): Promise<{ mensagem: string; valor_total: number }> {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido inválido.');
  }

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedidoPorIdBloqueado(conn, idPedido);
    if (!pedido) throw new Error('Pedido não encontrado.');

    if (!regras.podeEditarItensPedido(pedido.status_pedido)) {
      throw new Error(
        `Itens não podem ser alterados após confirmação (status atual: ${pedido.status_pedido}). Para alterar, cancele e crie um novo pedido.`
      );
    }

    const usuario = await repo.buscarUsuarioAtivo(conn, dados.id_user);
    if (!usuario) throw new Error('Usuário inválido ou inativo.');

    const pagamentoExistente = await repo.obterPagamentoPedido(conn, idPedido);
    if (pagamentoExistente && pagamentoExistente.status_pagamento === 'CONFIRMADO') {
      throw new Error('Não é possível alterar os itens de um pedido com pagamento já recebido.');
    }

    const itensProcessados: Array<{
      id_produto: number;
      tipo_produto: 'REVENDA' | 'FEITO';
      quantidade: number;
      preco_unitario: number;
      nome_produto: string;
    }> = [];

    for (const item of dados.itens) {
      const prod = await repo.buscarProdutoParaItem(conn, item.id_produto);
      if (!prod || !prod.ativo) {
        throw new Error(`Produto #${item.id_produto} não encontrado ou está inativo.`);
      }
      if (prod.tipo_produto === 'INGREDIENTE') {
        throw new Error(`O produto "${prod.nome_produto}" é um INGREDIENTE e não pode ser adicionado.`);
      }

      const quantidadeNormalizada = regras.arredondarQuantidade(item.quantidade, prod.unidade_medida);
      if (quantidadeNormalizada <= 0) {
        throw new Error(`Quantidade inválida para o produto "${prod.nome_produto}".`);
      }
      if (['un', 'und', 'unid', 'unidade', 'unidades', 'pç', 'pc', 'peça', 'peças', 'g', 'gr', 'grama', 'gramas'].includes(prod.unidade_medida.trim().toLowerCase())
          && !Number.isInteger(item.quantidade)) {
        throw new Error(`O produto "${prod.nome_produto}" é vendido por unidade inteira.`);
      }

      itensProcessados.push({
        id_produto: prod.id_produto,
        tipo_produto: prod.tipo_produto as 'REVENDA' | 'FEITO',
        quantidade: quantidadeNormalizada,
        preco_unitario: Number(prod.preco_produto),
        nome_produto: prod.nome_produto
      });
    }

    const taxa = dados.taxa_entrega !== undefined ? dados.taxa_entrega : Number(pedido.taxa_entrega);
    const { valorItens, valorTotal } = regras.calcularTotaisPedido(itensProcessados, taxa);

    await repo.removerItensDoPedido(conn, idPedido);
    for (const it of itensProcessados) {
      await repo.inserirItemPedido(conn, {
        id_pedido: idPedido,
        id_produto: it.id_produto,
        tipo_produto: it.tipo_produto,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario
      });
    }

    await repo.atualizarValoresPedido(conn, idPedido, valorTotal, taxa, dados.observacao);

    await repo.registrarHistorico(conn, {
      id_pedido: idPedido,
      tipo_evento: 'ALTERACAO_ITENS',
      valor_historico: valorTotal,
      descricao_historico: `Itens do pedido atualizados por ${usuario.nome_user}. Novo total: R$ ${valorTotal.toFixed(2)}.`
    });

    return {
      mensagem: 'Itens do pedido atualizados com sucesso.',
      valor_total: valorTotal
    };
  });
}

export async function excluirPedidoPendente(
  idPedido: number,
  idUser: number
): Promise<{ mensagem: string }> {
  if (!regras.inteiroPositivo(idPedido)) throw new Error('ID do pedido inválido.');

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedidoPorIdBloqueado(conn, idPedido);
    if (!pedido) throw new Error('Pedido não encontrado.');

    if (!regras.podeExcluirPedido(pedido.status_pedido)) {
      throw new Error(
        `Somente pedidos com status PENDENTE podem ser excluídos definitivamente. Pedidos confirmados devem ser cancelados.`
      );
    }

    const usuario = await repo.buscarUsuarioAtivo(conn, idUser);
    if (!usuario) throw new Error('Usuário responsável inválido.');

    const pagamento = await repo.obterPagamentoPedido(conn, idPedido);
    if (pagamento && pagamento.status_pagamento === 'CONFIRMADO') {
      throw new Error('Não é possível excluir pedido com pagamento confirmado.');
    }

    await repo.excluirPedidoDefinitivo(conn, idPedido);

    return { mensagem: `Pedido #${idPedido} excluído definitivamente com sucesso.` };
  });
}

export async function registrarPagamento(
  idPedido: number,
  dados: PagamentoInput,
  idUser: number
): Promise<{ mensagem: string }> {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido inválido.');
  }

  return await repo.executarTransacao(async (conn) => {
    const usuario = await repo.buscarUsuarioAtivo(conn, idUser);
    if (!usuario) throw new Error('Usuário responsável inválido ou inativo.');

    const pedido = await repo.buscarPedidoPorIdBloqueado(conn, idPedido);
    if (!pedido) throw new Error('Pedido não encontrado.');

    if (pedido.status_pedido === 'CANCELADO') {
      throw new Error('Não é possível adicionar pagamento a um pedido CANCELADO.');
    }

    const pagamentoExistente = await repo.obterPagamentoPedido(conn, idPedido);
    if (pagamentoExistente && pagamentoExistente.status_pagamento === 'CONFIRMADO') {
      throw new Error('Este pedido já possui um pagamento integral confirmado no sistema.');
    }

    regras.validarValorPagamento(dados.valor_pagamento, Number(pedido.valor_total));

    await repo.inserirPagamento(conn, {
      id_pedido: idPedido,
      valor_pagamento: dados.valor_pagamento,
      forma_pagamento: dados.forma_pagamento
    });

    await repo.registrarHistorico(conn, {
      id_pedido: idPedido,
      tipo_evento: 'ALTERACAO_VALOR',
      valor_historico: dados.valor_pagamento,
      descricao_historico: `Pagamento integral de R$ ${dados.valor_pagamento.toFixed(2)} registrado por ${usuario.nome_user} via ${dados.forma_pagamento}. Situação financeira: PAGO.`
    });

    return { mensagem: 'Pagamento integral registrado com sucesso.' };
  });
}

export async function atualizarStatus(
  idPedido: number,
  dados: AtualizarStatusInput
): Promise<{ mensagem: string; status_novo: string }> {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido inválido.');
  }

  if (dados.status_pedido === 'CANCELADO') {
    return await cancelarPedido(idPedido, dados.motivo, dados.id_user);
  }

  return await repo.executarTransacao(async (conn) => {
    const usuario = await repo.buscarUsuarioAtivo(conn, dados.id_user);
    if (!usuario) throw new Error('Usuário responsável inválido ou inativo.');

    const pedido = await repo.buscarPedidoPorIdBloqueado(conn, idPedido);
    if (!pedido) throw new Error('Pedido não encontrado.');

    regras.validarTransicaoStatus(pedido.status_pedido, dados.status_pedido);

    if (pedido.status_pedido === 'PENDENTE' && dados.status_pedido === 'CONFIRMADO') {
      // Correção 4: Passa a conexão ativa `conn` para buscarPedidoCompleto dentro da transação
      const itens = await repo.buscarPedidoCompleto(idPedido, conn);
      if (itens) {
        for (const it of itens.itens) {
          if (pedido.tipo_pedido === 'AGENDADO') {
            await estoqueService.reservarEstoquePedido({
              id_pedido: idPedido,
              id_produto: it.id_produto,
              quantidade: it.quantidade
            }, conn);
          }
        }

        if (pedido.tipo_pedido === 'IMEDIATO') {
          await estoqueService.baixarRevendaPedido(idPedido, false, dados.id_user, conn);
        }
      }
    }

    await repo.atualizarStatus(conn, idPedido, dados.status_pedido);
    await repo.registrarHistorico(conn, {
      id_pedido: idPedido,
      tipo_evento: dados.status_pedido === 'CONCLUIDO' ? 'CONCLUSAO' : 'ALTERACAO_STATUS',
      status_anterior: pedido.status_pedido,
      status_novo: dados.status_pedido,
      descricao_historico: dados.motivo
        ? `Status alterado por ${usuario.nome_user} de ${pedido.status_pedido} para ${dados.status_pedido}. Motivo: ${dados.motivo}`
        : `Status alterado por ${usuario.nome_user} de ${pedido.status_pedido} para ${dados.status_pedido}.`
    });

    return {
      mensagem: `Status do pedido atualizado para ${dados.status_pedido} com sucesso.`,
      status_novo: dados.status_pedido
    };
  });
}

export async function cancelarPedido(
  idPedido: number,
  motivo?: string,
  idUser?: number
): Promise<{ mensagem: string; status_novo: string }> {
  if (!regras.inteiroPositivo(idPedido)) {
    throw new Error('ID do pedido inválido.');
  }

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedidoPorIdBloqueado(conn, idPedido);
    if (!pedido) throw new Error('Pedido não encontrado.');
    if (!regras.podeCancelarPedido(pedido.status_pedido)) {
      throw new Error(`Não é possível cancelar um pedido com status ${pedido.status_pedido}.`);
    }

    if (idUser !== undefined) {
      const usuario = await repo.buscarUsuarioAtivo(conn, idUser);
      if (!usuario) throw new Error('Usuário responsável inválido ou inativo.');
    }

    const pag = await repo.obterPagamentoPedido(conn, idPedido);
    if (pag && pag.status_pagamento === 'CONFIRMADO') {
      await repo.estornarPagamento(conn, pag.id_pagamento);
      await repo.registrarHistorico(conn, {
        id_pedido: idPedido,
        tipo_evento: 'ALTERACAO_VALOR',
        status_anterior: pedido.status_pedido,
        valor_historico: Number(pag.valor_pagamento),
        descricao_historico: `Pagamento #${pag.id_pagamento} alterado para ESTORNADO devido ao cancelamento do pedido.`
      });
    }

    // Correção 1: Atualiza efetivamente o status do pedido para CANCELADO na tabela de pedidos
    await repo.atualizarStatus(conn, idPedido, 'CANCELADO');

    await repo.registrarHistorico(conn, {
      id_pedido: idPedido,
      tipo_evento: 'CANCELAMENTO',
      status_anterior: pedido.status_pedido,
      status_novo: 'CANCELADO',
      descricao_historico: motivo ? `Pedido cancelado. Motivo: ${motivo}` : 'Pedido cancelado.'
    });

    await estoqueService.devolverPedido(idPedido, idUser, conn, motivo);

    return {
      mensagem: 'Pedido cancelado; status, pagamento, estoque, reservas e pendências processados na mesma transação.',
      status_novo: 'CANCELADO'
    };
  });
}
