import * as repo from './estoque.repository';
import * as regras from './estoque.regras';
import type {
  CadastroProduto,
  EdicaoProduto,
  NovoLote,
  MovimentoEstoque,
  RecebimentoCompra,
  RegistroProducaoFeito,
  TipoProduto,
  FiltroMovimentacao,
  NecessidadeCompra,
  BaixaFeito,
  ReservaEstoqueInput
} from './estoque.types';

export async function listar(tipo?: TipoProduto) {
  return await repo.listarEstoque(tipo);
}

export async function lotes(idProduto: number) {
  if (!regras.inteiroPositivo(idProduto)) throw new Error('ID do produto inválido.');
  return await repo.listarLotes(idProduto);
}

export async function historico(filtro: FiltroMovimentacao) {
  return await repo.listarMovimentacoes(filtro);
}

export async function necessidadesCompra(): Promise<NecessidadeCompra[]> {
  const produtos = await repo.listarEstoque();
  const emCompra = await repo.quantidadesEmCompra();

  const necessidades: NecessidadeCompra[] = [];
  for (const p of produtos) {
    if (p.tipo_produto === 'FEITO') continue;
    if (!p.controla_estoque || p.estoque_minimo <= 0) continue;

    const pendente = emCompra.get(p.id_produto) ?? 0;
    const falta = regras.arredondar(p.estoque_minimo - (p.saldo_disponivel + pendente));

    if (falta > 0) {
      necessidades.push({
        id_produto: p.id_produto,
        nome_produto: p.nome_produto,
        tipo_produto: p.tipo_produto,
        unidade_medida: p.unidade_medida,
        saldo_atual: p.saldo_atual,
        estoque_minimo: p.estoque_minimo,
        quantidade_em_compra: pendente,
        quantidade_comprar: falta
      });
    }
  }
  return necessidades;
}

export async function obterProduto(id: number) {
  if (!regras.inteiroPositivo(id)) throw new Error('ID do produto inválido.');
  const prod = await repo.obterProduto(id);
  if (!prod) throw new Error('Produto não encontrado.');
  return prod;
}

export async function cadastrar(d: CadastroProduto) {
  if (!d.nome_produto || typeof d.nome_produto !== 'string' || d.nome_produto.trim() === '') {
    throw new Error('Nome do produto é obrigatório.');
  }
  if (!['INGREDIENTE', 'REVENDA', 'FEITO'].includes(d.tipo_produto)) {
    throw new Error('Tipo de produto inválido.');
  }
  if (!d.unidade_medida || typeof d.unidade_medida !== 'string' || d.unidade_medida.trim() === '') {
    throw new Error('Unidade de medida é obrigatória.');
  }
  regras.validarPrecoEEstoqueMinimo(d.preco_produto, d.estoque_minimo);

  if (d.id_categoria) {
    const valida = await repo.categoriaAtiva(d.id_categoria);
    if (!valida) throw new Error('Categoria informada não existe ou está inativa.');
  }
  return await repo.cadastrarProduto(d);
}

export async function editarProduto(id: number, d: EdicaoProduto) {
  if (!regras.inteiroPositivo(id)) throw new Error('ID do produto inválido.');
  const atual = await repo.obterProduto(id);
  if (!atual) throw new Error('Produto não encontrado.');

  regras.validarPrecoEEstoqueMinimo(d.preco_produto, d.estoque_minimo);

  if (d.id_categoria) {
    const valida = await repo.categoriaAtiva(d.id_categoria);
    if (!valida) throw new Error('Categoria informada não existe ou está inativa.');
  }

  await repo.atualizarProduto(id, {
    nome_produto: d.nome_produto,
    descricao_produto: d.descricao_produto,
    marca: d.marca,
    unidade_medida: d.unidade_medida,
    preco_produto: d.preco_produto,
    estoque_minimo: d.estoque_minimo,
    id_categoria: d.id_categoria
  });

  return { mensagem: 'Produto atualizado com sucesso.' };
}

export async function desativarProduto(id: number) {
  if (!regras.inteiroPositivo(id)) throw new Error('ID do produto inválido.');

  const saldoFisico = await repo.saldoFisicoTotalProduto(id);
  if (saldoFisico > 0) {
    throw new Error(`Não é possível desativar um produto que ainda possui saldo em estoque (${saldoFisico}).`);
  }

  const reservas = await repo.reservasAtivasProduto(id);
  if (reservas > 0) {
    throw new Error(`Não é possível desativar um produto com reservas ativas pendentes (${reservas}).`);
  }

  await repo.desativarProduto(id);
  return { mensagem: 'Produto desativado com sucesso.' };
}

export async function criarLote(d: NovoLote) {
  if (!regras.inteiroPositivo(d.id_produto)) throw new Error('ID do produto inválido.');
  regras.validarQuantidade(d.quantidade);
  if (d.data_validade && !regras.dataValida(d.data_validade)) {
    throw new Error('Data de validade inválida. Formato esperado: AAAA-MM-DD.');
  }

  return await repo.executarTransacao(async (conn) => {
    const produto = await repo.buscarProduto(conn, d.id_produto);
    if (!produto) throw new Error('Produto não encontrado ou inativo.');
    if (produto.tipo_produto === 'FEITO') {
      throw new Error('Produtos FEITOS não possuem lotes diretos no banco de dados. Registre a produção.');
    }

    const idLote = await repo.inserirLote(conn, produto, d);
    await repo.registrarMovimentacao(conn, {
      id_produto: produto.id_produto,
      tipo_produto: produto.tipo_produto,
      id_lote: idLote,
      tipo_movimentacao: 'ENTRADA',
      quantidade: d.quantidade,
      motivo: 'Cadastro inicial do lote'
    });

    return { id_lote: idLote };
  });
}

export async function movimentar(d: MovimentoEstoque) {
  if (!regras.inteiroPositivo(d.id_lote)) throw new Error('ID do lote inválido.');
  const permitirNegativo = d.tipo_movimentacao === 'AJUSTE';
  regras.validarQuantidade(d.quantidade, permitirNegativo);

  if (['PERDA', 'AJUSTE'].includes(d.tipo_movimentacao) && !d.motivo) {
    throw new Error('Motivo é obrigatório para movimentações de PERDA e AJUSTE.');
  }

  return await repo.executarTransacao(async (conn) => {
    const lote = await repo.buscarLote(conn, d.id_lote);
    if (!lote) throw new Error('Lote não encontrado.');

    if (Boolean(lote.vencido) && !d.confirmar_vencido && ['SAIDA', 'ENTRADA'].includes(d.tipo_movimentacao)) {
      throw new Error('Este lote está vencido. Confirme a operação para prosseguir.');
    }

    const delta = regras.calcularDelta(d.tipo_movimentacao, d.quantidade);
    const novoSaldo = regras.calcularNovoSaldo(
      Number(lote.quantidade_atual),
      Number(lote.quantidade_inicial),
      delta
    );

    await repo.atualizarLote(conn, lote.id_lote, novoSaldo);
    const idMov = await repo.registrarMovimentacao(conn, {
      id_produto: lote.id_produto,
      tipo_produto: lote.tipo_produto,
      id_lote: lote.id_lote,
      tipo_movimentacao: d.tipo_movimentacao,
      quantidade: delta,
      motivo: d.motivo,
      id_user: d.id_user
    });

    return { id_movimentacao: idMov, saldo_anterior: Number(lote.quantidade_atual), novo_saldo: novoSaldo };
  });
}

export async function reservarEstoquePedido(d: ReservaEstoqueInput) {
  if (!regras.inteiroPositivo(d.id_pedido) || !regras.inteiroPositivo(d.id_produto)) {
    throw new Error('Pedido e produto são obrigatórios.');
  }
  regras.validarQuantidade(d.quantidade);

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedido(conn, d.id_pedido);
    if (!pedido || pedido.status_pedido === 'CANCELADO') throw new Error('Pedido inexistente ou cancelado.');

    const produto = await repo.buscarProduto(conn, d.id_produto);
    if (!produto) throw new Error('Produto não encontrado ou inativo.');

    let saldoValido = 0;
    if (produto.tipo_produto === 'FEITO') {
      saldoValido = await repo.bloquearEstoqueFeito(conn, d.id_produto);
    } else {
      const lotes = await repo.buscarLotesFEFO(conn, d.id_produto);
      saldoValido = lotes.filter((l) => !l.vencido).reduce((acc, l) => acc + Number(l.quantidade_atual), 0);
    }

    const jaReservado = await repo.reservadoProduto(conn, d.id_produto, d.id_pedido);
    const disponivel = regras.saldoDisponivel(saldoValido, jaReservado);

    if (disponivel < d.quantidade) {
      const faltante = regras.arredondar(d.quantidade - disponivel);
      await repo.inserirPendencia(conn, {
        id_pedido: d.id_pedido,
        id_produto: d.id_produto,
        quantidade: faltante,
        motivo: `Reserva parcial: faltam ${faltante} unidades do produto ${produto.nome_produto}`
      });
      throw new Error(`Saldo disponível insuficiente (${disponivel}) para reservar ${d.quantidade}. Pendência registrada.`);
    }

    const idReserva = await repo.criarReserva(conn, d);
    return { id_reserva: idReserva, mensagem: 'Reserva criada com sucesso.' };
  });
}

export async function registrarProducaoFeito(d: RegistroProducaoFeito) {
  if (!regras.inteiroPositivo(d.id_pedido) || !regras.inteiroPositivo(d.id_produto_feito)) {
    throw new Error('Pedido e produto FEITO são obrigatórios.');
  }
  regras.validarQuantidade(d.quantidade_produzida);
  const perdas = d.quantidade_perdida ?? 0;
  if (perdas < 0 || !Number.isFinite(perdas)) throw new Error('Perdas inválidas.');
  if (perdas > 0) regras.validarQuantidade(perdas);

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedido(conn, d.id_pedido);
    if (!pedido || pedido.status_pedido === 'CANCELADO') throw new Error('Pedido inexistente ou cancelado.');

    const item = await repo.buscarItemPedidoFeito(conn, d.id_pedido, d.id_produto_feito);
    if (!item || item.tipo_produto !== 'FEITO') throw new Error('Produto FEITO não pertence ao pedido.');

    const produto = await repo.buscarProduto(conn, d.id_produto_feito);
    if (!produto || produto.tipo_produto !== 'FEITO') throw new Error('Produto FEITO inválido.');

    const receita = await repo.obterReceitaProdutoFeito(conn, d.id_produto_feito);
    if (!receita || receita.detalhes.status_receita !== 'ATIVA') throw new Error('Receita ATIVA é obrigatória.');

    const rendimento = Number(receita.detalhes.rendimento_receita);
    if (rendimento <= 0) throw new Error('Rendimento da receita inválido.');

    const [anteriores] = await conn.query<import('mysql2/promise').RowDataPacket[]>(
      `SELECT COALESCE(SUM(quantidade_concluida), 0) AS total_concluido
       FROM producoes WHERE id_pedido = ? AND id_produto_feito = ?`,
      [d.id_pedido, d.id_produto_feito]
    );
    const totalBomJaProduzido = Number(anteriores[0]?.total_concluido ?? 0);
    const qtdPedida = Number(item.quantidade);

    if (totalBomJaProduzido + d.quantidade_produzida > qtdPedida + 0.000001) {
      throw new Error(`Quantidade produzida excede o saldo restante do pedido (já produzidas boas: ${totalBomJaProduzido}, pedido: ${qtdPedida}).`);
    }

    const totalInsumosPlanejados = regras.arredondar(d.quantidade_produzida + perdas);

    const snapshot = JSON.stringify({
      tempo_preparo_minutos: receita.detalhes.tempo_preparo_minutos,
      rendimento_receita: rendimento,
      custos_fixos: Number(receita.detalhes.custos_fixos),
      custo_mao_obra: Number(receita.detalhes.custo_mao_obra),
      margem_lucro: Number(receita.detalhes.margem_lucro),
      ingredientes: receita.ingredientes,
      quantidade_planejada: totalInsumosPlanejados,
      perdas_registradas: perdas
    });

    const statusProducao = totalBomJaProduzido + d.quantidade_produzida >= qtdPedida ? 'CONCLUIDA' : 'PARCIAL';

    const [insercao] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO producoes (id_pedido, id_produto_feito, quantidade_planejada,
        quantidade_concluida, quantidade_perdida, status_producao, receita_snapshot,
        data_inicio, data_conclusao)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [d.id_pedido, d.id_produto_feito, totalInsumosPlanejados, d.quantidade_produzida, perdas, statusProducao, snapshot]
    );
    const idProducao = insercao.insertId;

    for (const ing of receita.ingredientes) {
      const necessaria = regras.arredondar((Number(ing.quantidade) * totalInsumosPlanejados) / rendimento);
      if (necessaria <= 0) continue;

      const lotes = await repo.buscarLotesFEFO(conn, ing.id_ingrediente);
      const plano = regras.planejarConsumo(
        lotes.map((l) => ({
          id_lote: l.id_lote,
          quantidade_atual: Number(l.quantidade_atual),
          vencido: Boolean(l.vencido)
        })),
        necessaria,
        Boolean(d.confirmar_vencidos)
      );

      if (plano.faltante > 0) {
        await repo.inserirPendencia(conn, {
          id_pedido: d.id_pedido,
          id_producao: idProducao,
          id_produto: ing.id_ingrediente,
          quantidade: plano.faltante,
          motivo: `Falta de insumo ${ing.nome_produto} para a produção #${idProducao}`
        });
        throw new Error(
          `Ingrediente ${ing.nome_produto} insuficiente: faltam ${plano.faltante}. Pendência registrada.`
        );
      }

      for (const uso of plano.usos) {
        await repo.atualizarLote(conn, uso.id_lote, uso.saldo_restante);
        await repo.registrarMovimentacao(conn, {
          id_produto: ing.id_ingrediente,
          tipo_produto: 'INGREDIENTE',
          id_lote: uso.id_lote,
          id_pedido: d.id_pedido,
          tipo_movimentacao: 'SAIDA',
          quantidade: -uso.quantidade,
          motivo: `Consumo da produção #${idProducao}`,
          id_user: d.id_user
        });
        await conn.execute(
          `INSERT INTO consumo_producao (id_producao, id_lote, id_ingrediente, quantidade_consumida)
           VALUES (?, ?, ?, ?)`,
          [idProducao, uso.id_lote, ing.id_ingrediente, uso.quantidade]
        );
      }
    }

    const saldo = await repo.bloquearEstoqueFeito(conn, d.id_produto_feito);
    await repo.atualizarEstoqueFeito(conn, d.id_produto_feito, regras.arredondar(saldo + d.quantidade_produzida));
    await repo.movimentarFeito(conn, {
      id_produto_feito: d.id_produto_feito,
      id_producao: idProducao,
      id_pedido: d.id_pedido,
      tipo_movimentacao: 'ENTRADA',
      quantidade: d.quantidade_produzida,
      motivo: `Conclusão da produção #${idProducao}`
    });

    await repo.registrarHistoricoPedido(conn, {
      id_pedido: d.id_pedido,
      tipo_evento: 'ALTERACAO_STATUS',
      status_anterior: pedido.status_pedido,
      status_novo: statusProducao === 'CONCLUIDA' ? 'PRONTO' : 'EM_PREPARACAO',
      descricao_historico: `Produzidas ${d.quantidade_produzida} un do produto #${d.id_produto_feito} (Perdas: ${perdas}).`
    });

    if (pedido.status_pedido === 'PENDENTE' || pedido.status_pedido === 'CONFIRMADO') {
      await repo.atualizarStatusPedido(conn, d.id_pedido, 'EM_PREPARACAO');
    }

    return {
      id_producao: idProducao,
      quantidade_produzida: d.quantidade_produzida,
      quantidade_perdida: perdas,
      status_producao: statusProducao,
      mensagem: 'Produção registrada e estoque de FEITOS atualizado com sucesso.'
    };
  });
}

export async function baixarFeitoPedido(d: BaixaFeito) {
  if (!regras.inteiroPositivo(d.id_pedido) || !regras.inteiroPositivo(d.id_produto_feito)) {
    throw new Error('Pedido e produto inválidos.');
  }
  regras.validarQuantidade(d.quantidade);

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedido(conn, d.id_pedido);
    if (!pedido || pedido.status_pedido === 'CANCELADO') throw new Error('Pedido inexistente ou cancelado.');

    const item = await repo.buscarItemPedidoFeito(conn, d.id_pedido, d.id_produto_feito);
    if (!item || item.tipo_produto !== 'FEITO') throw new Error('Produto não pertence ao pedido.');

    const [anteriores] = await conn.query<import('mysql2/promise').RowDataPacket[]>(
      `SELECT COALESCE(-SUM(quantidade), 0) AS baixado FROM movimentacoes_feitos
       WHERE id_pedido = ? AND id_produto_feito = ? AND tipo_movimentacao = 'SAIDA'`,
      [d.id_pedido, d.id_produto_feito]
    );

    if (Number(anteriores[0]?.baixado ?? 0) + d.quantidade > Number(item.quantidade) + 0.000001) {
      throw new Error('Baixa ultrapassa a quantidade pedida.');
    }

    const saldo = await repo.bloquearEstoqueFeito(conn, d.id_produto_feito);
    const reservadoOutros = await repo.reservadoProduto(conn, d.id_produto_feito, d.id_pedido);

    if (saldo - reservadoOutros < d.quantidade) {
      const faltante = regras.arredondar(d.quantidade - (saldo - reservadoOutros));
      await repo.inserirPendencia(conn, {
        id_pedido: d.id_pedido,
        id_produto: d.id_produto_feito,
        quantidade: Math.max(0, faltante),
        motivo: 'Estoque insuficiente de produto FEITO na tentativa de baixa'
      });
      throw new Error('Saldo de produto FEITO disponível insuficiente.');
    }

    await repo.atualizarEstoqueFeito(conn, d.id_produto_feito, regras.arredondar(saldo - d.quantidade));
    await repo.movimentarFeito(conn, {
      id_produto_feito: d.id_produto_feito,
      id_pedido: d.id_pedido,
      tipo_movimentacao: 'SAIDA',
      quantidade: -d.quantidade,
      motivo: `Entrega do produto FEITO no pedido #${d.id_pedido}`
    });

    const reservas = await repo.buscarReservasAtivasPedido(conn, d.id_pedido, d.id_produto_feito);
    let restanteBaixa = d.quantidade;
    for (const res of reservas) {
      if (restanteBaixa <= 0) break;
      const saldoRes = Number(res.quantidade_reservada) - Number(res.quantidade_consumida);
      const usar = Math.min(restanteBaixa, saldoRes);
      const finalizada = usar >= saldoRes;
      await repo.consumirReserva(conn, res.id_reserva, usar, finalizada);
      restanteBaixa = regras.arredondar(restanteBaixa - usar);
    }

    await repo.registrarHistoricoPedido(conn, {
      id_pedido: d.id_pedido,
      tipo_evento: 'OUTRO',
      descricao_historico: `Baixa de entrega efetuada: ${d.quantidade} un do produto FEITO #${d.id_produto_feito}.`
    });

    return { mensagem: 'Baixa do produto FEITO registrada com sucesso.', saldo_restante: saldo - d.quantidade };
  });
}

export async function producoesPedido(idPedido: number) {
  if (!regras.inteiroPositivo(idPedido)) throw new Error('Pedido inválido.');
  return repo.listarProducoes(idPedido);
}

export async function receberCompra(d: RecebimentoCompra) {
  if (!regras.inteiroPositivo(d.id_compra)) throw new Error('ID da compra inválido.');

  return await repo.executarTransacao(async (conn) => {
    const compra = await repo.buscarCompra(conn, d.id_compra);
    if (!compra) throw new Error('Compra não encontrada.');
    if (compra.status_compra === 'RECEBIDA') throw new Error('Esta compra já foi recebida anteriormente.');
    if (compra.status_compra === 'CANCELADA') throw new Error('Não é possível receber uma compra CANCELADA.');

    const itens = await repo.itensDaCompra(conn, d.id_compra);
    if (itens.length === 0) throw new Error('A compra não possui itens para receber.');

    const mapaRecebimento = new Map<number, { data_validade?: string | null; codigo_lote?: string | null }>();
    if (d.itens) {
      for (const it of d.itens) {
        mapaRecebimento.set(it.id_item_compra, {
          data_validade: it.data_validade,
          codigo_lote: it.codigo_lote
        });
      }
    }

    for (const item of itens) {
      const extra = mapaRecebimento.get(item.id_item_compra);
      if (extra?.data_validade && !regras.dataValida(extra.data_validade)) {
        throw new Error(`Data de validade inválida para o item de compra ${item.id_item_compra}.`);
      }

      const qtd = Number(item.quantidade);
      const idLote = await repo.inserirLote(
        conn,
        { id_produto: item.id_produto, tipo_produto: item.tipo_produto },
        {
          quantidade: qtd,
          codigo_lote: extra?.codigo_lote ?? `COMPRA-${d.id_compra}`,
          data_validade: extra?.data_validade ?? null,
          id_item_compra: item.id_item_compra
        }
      );

      await repo.registrarMovimentacao(conn, {
        id_produto: item.id_produto,
        tipo_produto: item.tipo_produto,
        id_lote: idLote,
        id_item_compra: item.id_item_compra,
        tipo_movimentacao: 'ENTRADA',
        quantidade: qtd,
        motivo: `Recebimento da compra #${d.id_compra}`,
        id_user: d.id_user
      });
    }

    await repo.marcarCompraRecebida(conn, d.id_compra);
    return { mensagem: 'Compra recebida com sucesso e lotes criados.', id_compra: d.id_compra };
  });
}

export async function baixarRevendaPedido(idPedido: number, confirmarVencidos = false, idUser?: number) {
  if (!regras.inteiroPositivo(idPedido)) throw new Error('ID do pedido inválido.');

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedido(conn, idPedido);
    if (!pedido) throw new Error('Pedido não encontrado.');
    if (pedido.status_pedido === 'CANCELADO') {
      throw new Error('Não é possível movimentar estoque de um pedido CANCELADO.');
    }

    const movimentacoesAnteriores = await repo.movimentadoPorPedido(conn, idPedido);
    if (movimentacoesAnteriores.length > 0) {
      const jaBaixou = movimentacoesAnteriores.some((m) => Number(m.liquido) < 0);
      if (jaBaixou) throw new Error('Já existe baixa de itens de REVENDA efetuada para este pedido.');
    }

    const itens = await repo.itensDoPedido(conn, idPedido);
    if (itens.length === 0) throw new Error('O pedido não possui itens.');

    const itensRevenda = itens.filter((it) => it.tipo_produto === 'REVENDA');
    if (itensRevenda.length === 0) {
      return { mensagem: 'Pedido não possui itens de REVENDA para baixar.', id_pedido: idPedido };
    }

    for (const item of itensRevenda) {
      const qtdPedida = Number(item.quantidade);
      const lotes = await repo.buscarLotesFEFO(conn, item.id_produto);
      const plano = regras.planejarConsumo(
        lotes.map((l) => ({
          id_lote: l.id_lote,
          quantidade_atual: Number(l.quantidade_atual),
          vencido: Boolean(l.vencido)
        })),
        qtdPedida,
        confirmarVencidos
      );

      if (plano.faltante > 0) {
        await repo.inserirPendencia(conn, {
          id_pedido: idPedido,
          id_produto: item.id_produto,
          quantidade: plano.faltante,
          motivo: `Estoque insuficiente de REVENDA ao faturar o pedido #${idPedido}`
        });
        throw new Error(
          `Estoque insuficiente para o produto REVENDA (ID ${item.id_produto}). Faltam ${plano.faltante}. Pendência registrada.`
        );
      }

      for (const uso of plano.usos) {
        await repo.atualizarLote(conn, uso.id_lote, uso.saldo_restante);
        await repo.registrarMovimentacao(conn, {
          id_produto: item.id_produto,
          tipo_produto: 'REVENDA',
          id_lote: uso.id_lote,
          id_pedido: idPedido,
          tipo_movimentacao: 'SAIDA',
          quantidade: -uso.quantidade,
          motivo: `Baixa de venda do pedido #${idPedido}`,
          id_user: idUser
        });
      }

      const reservas = await repo.buscarReservasAtivasPedido(conn, idPedido, item.id_produto);
      let restanteBaixa = qtdPedida;
      for (const res of reservas) {
        if (restanteBaixa <= 0) break;
        const saldoRes = Number(res.quantidade_reservada) - Number(res.quantidade_consumida);
        const usar = Math.min(restanteBaixa, saldoRes);
        await repo.consumirReserva(conn, res.id_reserva, usar, usar >= saldoRes);
        restanteBaixa = regras.arredondar(restanteBaixa - usar);
      }
    }

    await repo.registrarHistoricoPedido(conn, {
      id_pedido: idPedido,
      tipo_evento: 'OUTRO',
      descricao_historico: `Baixa dos itens de REVENDA efetuada com sucesso.`
    });

    return { mensagem: 'Baixa dos itens de revenda efetuada com sucesso.', id_pedido: idPedido };
  });
}

export async function devolverPedido(idPedido: number, idUser?: number) {
  if (!regras.inteiroPositivo(idPedido)) throw new Error('ID do pedido inválido.');

  return await repo.executarTransacao(async (conn) => {
    const pedido = await repo.buscarPedido(conn, idPedido);
    if (!pedido) throw new Error('Pedido não encontrado.');

    const baixasLotes = await repo.movimentadoPorPedido(conn, idPedido);
    const baixasFeitos = await repo.movimentadoFeitoPorPedido(conn, idPedido);

    let houveEstorno = false;

    for (const mov of baixasLotes) {
      const qtdLiquida = Number(mov.liquido);
      if (qtdLiquida < 0) {
        houveEstorno = true;
        const estornar = Math.abs(qtdLiquida);
        const lote = await repo.buscarLote(conn, mov.id_lote);
        if (!lote) throw new Error(`Lote #${mov.id_lote} não encontrado para devolução.`);

        const novoSaldo = regras.calcularNovoSaldo(
          Number(lote.quantidade_atual),
          Number(lote.quantidade_inicial),
          estornar
        );

        await repo.atualizarLote(conn, mov.id_lote, novoSaldo);
        await repo.registrarMovimentacao(conn, {
          id_produto: mov.id_produto,
          tipo_produto: mov.tipo_produto,
          id_lote: mov.id_lote,
          id_pedido: idPedido,
          tipo_movimentacao: 'ENTRADA',
          quantidade: estornar,
          motivo: `Devolução do pedido #${idPedido}`,
          id_user: idUser
        });
      }
    }

    for (const mf of baixasFeitos) {
      const qtdLiquida = Number(mf.liquido);
      if (qtdLiquida < 0) {
        houveEstorno = true;
        const estornar = Math.abs(qtdLiquida);
        const saldoAtual = await repo.bloquearEstoqueFeito(conn, mf.id_produto_feito);
        await repo.atualizarEstoqueFeito(conn, mf.id_produto_feito, regras.arredondar(saldoAtual + estornar));
        await repo.movimentarFeito(conn, {
          id_produto_feito: mf.id_produto_feito,
          id_pedido: idPedido,
          tipo_movimentacao: 'ENTRADA',
          quantidade: estornar,
          motivo: `Devolução de produto FEITO do pedido #${idPedido}`
        });
      }
    }

    await repo.liberarReservasPedido(conn, idPedido);

    await repo.atualizarStatusPedido(conn, idPedido, 'CANCELADO');
    await repo.registrarHistoricoPedido(conn, {
      id_pedido: idPedido,
      tipo_evento: 'CANCELAMENTO',
      status_anterior: pedido.status_pedido,
      status_novo: 'CANCELADO',
      descricao_historico: houveEstorno
        ? `Pedido cancelado: itens e produtos prontos devolvidos ao estoque e reservas liberadas.`
        : `Pedido cancelado e reservas ativas liberadas.`
    });

    return {
      mensagem: houveEstorno
        ? 'Devolução de estoque (revenda e feitos) e cancelamento efetuados com sucesso.'
        : 'Pedido cancelado e reservas liberadas sem necessidade de reposição física.',
      id_pedido: idPedido
    };
  });
}
