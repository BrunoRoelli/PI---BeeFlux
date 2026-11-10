import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../database/connection';
import type {
  StatusPedido,
  TipoPedido,
  FormaPagamento,
  FiltroPedidos,
  PedidoCompleto
} from './pedidos.types';
import { formatarNumeroExibicao, determinarStatusFinanceiro } from './pedidos.regras';

export async function executarTransacao<T>(
  fn: (conn: PoolConnection) => Promise<T>,
  chaveBloqueio?: string
): Promise<T> {
  const conn = await pool.getConnection();
  let bloqueioAdquirido = false;

  // GET_LOCK serializa operações que tentam reservar o mesmo horário,
  // inclusive quando chegam simultaneamente em processos diferentes.
  const instanteBloqueio = chaveBloqueio ? new Date(chaveBloqueio) : null;
  const chaveCanonica = instanteBloqueio && Number.isFinite(instanteBloqueio.getTime())
    ? instanteBloqueio.toISOString()
    : chaveBloqueio;
  const nomeBloqueio = chaveCanonica
    ? `beeflux_ag_${chaveCanonica.replace(/[^0-9A-Za-z]/g, '').slice(0, 45)}`
    : undefined;

  try {
    if (nomeBloqueio) {
      const [lockRows] = await conn.query<RowDataPacket[]>(
        'SELECT GET_LOCK(?, 10) AS adquirido',
        [nomeBloqueio]
      );
      if (Number(lockRows[0]?.adquirido) !== 1) {
        throw new Error('Não foi possível reservar este horário agora. Tente novamente.');
      }
      bloqueioAdquirido = true;
    }

    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch { /* conexão pode já estar sem transação */ }
    throw e;
  } finally {
    if (bloqueioAdquirido && nomeBloqueio) {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [nomeBloqueio]);
      } catch (e) {
        console.error('Falha ao liberar bloqueio de horário MySQL:', e);
      }
    }
    conn.release();
  }
}

export async function buscarUsuarioAtivo(conn: PoolConnection, idUser: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_user, nome_user FROM usuarios WHERE id_user = ? AND ativo = 1',
    [idUser]
  );
  return rows[0] as { id_user: number; nome_user: string } | undefined;
}

export async function buscarClientePorId(conn: PoolConnection, idCliente: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_cliente, nome_cliente, telefone_cliente FROM clientes WHERE id_cliente = ?',
    [idCliente]
  );
  return rows[0] as { id_cliente: number; nome_cliente: string; telefone_cliente: string } | undefined;
}

export async function buscarProdutoParaItem(conn: PoolConnection, idProduto: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_produto, nome_produto, tipo_produto, unidade_medida, preco_produto, ativo 
     FROM produtos 
     WHERE id_produto = ? FOR UPDATE`,
    [idProduto]
  );
  return rows[0] as
    | {
        id_produto: number;
        nome_produto: string;
        tipo_produto: 'REVENDA' | 'INGREDIENTE' | 'FEITO';
        unidade_medida: string;
        preco_produto: string;
        ativo: number;
      }
    | undefined;
}

export async function inserirPedido(
  conn: PoolConnection,
  d: {
    id_cliente: number | null;
    tipo_pedido: TipoPedido;
    observacao: string | null;
    taxa_entrega: number;
    valor_total: number;
  }
): Promise<number> {
  const [result] = await conn.execute<ResultSetHeader>(
    `INSERT INTO pedidos (id_cliente, tipo_pedido, observacao, taxa_entrega, valor_total, status_pedido)
     VALUES (?, ?, ?, ?, ?, 'PENDENTE')`,
    [d.id_cliente, d.tipo_pedido, d.observacao, d.taxa_entrega, d.valor_total]
  );
  return result.insertId;
}

export async function inserirItemPedido(
  conn: PoolConnection,
  d: {
    id_pedido: number;
    id_produto: number;
    tipo_produto: 'REVENDA' | 'FEITO';
    quantidade: number;
    preco_unitario: number;
  }
): Promise<number> {
  const [result] = await conn.execute<ResultSetHeader>(
    `INSERT INTO item_pedido (id_pedido, id_produto, tipo_produto, quantidade, preco_unitario)
     VALUES (?, ?, ?, ?, ?)`,
    [d.id_pedido, d.id_produto, d.tipo_produto, d.quantidade, d.preco_unitario]
  );
  return result.insertId;
}

export async function removerItensDoPedido(conn: PoolConnection, idPedido: number): Promise<void> {
  await conn.execute('DELETE FROM item_pedido WHERE id_pedido = ?', [idPedido]);
}

export async function atualizarValoresPedido(
  conn: PoolConnection,
  idPedido: number,
  valorTotal: number,
  taxaEntrega: number,
  observacao?: string | null
): Promise<void> {
  await conn.execute(
    `UPDATE pedidos 
     SET valor_total = ?, taxa_entrega = ?, observacao = COALESCE(?, observacao)
     WHERE id_pedido = ?`,
    [valorTotal, taxaEntrega, observacao ?? null, idPedido]
  );
}

export async function inserirPagamento(
  conn: PoolConnection,
  d: {
    id_pedido: number;
    valor_pagamento: number;
    forma_pagamento: FormaPagamento;
  }
): Promise<number> {
  const [result] = await conn.execute<ResultSetHeader>(
    `INSERT INTO pagamentos (id_pedido, valor_pagamento, forma_pagamento, status_pagamento)
     VALUES (?, ?, ?, 'CONFIRMADO')`,
    [d.id_pedido, d.valor_pagamento, d.forma_pagamento]
  );
  return result.insertId;
}

export async function registrarHistorico(
  conn: PoolConnection,
  d: {
    id_pedido: number;
    tipo_evento:
      | 'CRIACAO'
      | 'ALTERACAO_ITENS'
      | 'ALTERACAO_VALOR'
      | 'ALTERACAO_STATUS'
      | 'CANCELAMENTO'
      | 'CONCLUSAO'
      | 'EXCLUSAO'
      | 'OUTRO';
    status_anterior?: string | null;
    status_novo?: string | null;
    valor_historico?: number | null;
    descricao_historico: string;
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO historico_pedidos (id_pedido, tipo_evento, status_anterior, status_novo, valor_historico, descricao_historico)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      d.id_pedido,
      d.tipo_evento,
      d.status_anterior ?? null,
      d.status_novo ?? null,
      d.valor_historico ?? null,
      d.descricao_historico
    ]
  );
}

export async function buscarPedidoPorIdBloqueado(conn: PoolConnection, idPedido: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_pedido, id_cliente, tipo_pedido, status_pedido, valor_total, taxa_entrega, observacao, data_pedido
     FROM pedidos WHERE id_pedido = ? FOR UPDATE`,
    [idPedido]
  );
  return rows[0] as
    | {
        id_pedido: number;
        id_cliente: number | null;
        tipo_pedido: TipoPedido;
        status_pedido: StatusPedido;
        valor_total: string;
        taxa_entrega: string;
        observacao: string | null;
        data_pedido: Date;
      }
    | undefined;
}

export async function atualizarStatus(conn: PoolConnection, idPedido: number, status: StatusPedido) {
  await conn.execute('UPDATE pedidos SET status_pedido = ? WHERE id_pedido = ?', [status, idPedido]);
}

export async function obterPagamentoPedido(conn: PoolConnection, idPedido: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_pagamento, valor_pagamento, forma_pagamento, status_pagamento FROM pagamentos WHERE id_pedido = ? FOR UPDATE',
    [idPedido]
  );
  return rows[0] as
    | {
        id_pagamento: number;
        valor_pagamento: string;
        forma_pagamento: FormaPagamento;
        status_pagamento: 'PENDENTE' | 'CONFIRMADO' | 'ESTORNADO';
      }
    | undefined;
}

export async function estornarPagamento(conn: PoolConnection, idPagamento: number) {
  await conn.execute("UPDATE pagamentos SET status_pagamento = 'ESTORNADO' WHERE id_pagamento = ?", [
    idPagamento
  ]);
}

export async function excluirPedidoDefinitivo(conn: PoolConnection, idPedido: number): Promise<void> {
  await conn.execute('DELETE FROM agendamentos WHERE id_pedido = ?', [idPedido]);
  await conn.execute('DELETE FROM item_pedido WHERE id_pedido = ?', [idPedido]);
  await conn.execute('DELETE FROM historico_pedidos WHERE id_pedido = ?', [idPedido]);
  await conn.execute('DELETE FROM pedidos WHERE id_pedido = ?', [idPedido]);
}

// Correção 4: buscarPedidoCompleto aceita conexão opcional (conn?: PoolConnection) para manter transações ativas
export async function buscarPedidoCompleto(idPedido: number, conn?: PoolConnection): Promise<PedidoCompleto | null> {
  const executor = conn || pool;

  const sqlPedido = `
    SELECT 
      p.id_pedido,
      p.id_cliente,
      c.nome_cliente,
      c.telefone_cliente,
      p.data_pedido,
      p.tipo_pedido,
      p.status_pedido,
      p.observacao,
      p.taxa_entrega,
      p.valor_total,
      pg.id_pagamento,
      pg.valor_pagamento,
      pg.data_pagamento,
      pg.forma_pagamento,
      pg.status_pagamento,
      pg.observacao AS obs_pagamento
    FROM pedidos p
    LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
    LEFT JOIN pagamentos pg ON pg.id_pedido = p.id_pedido
    WHERE p.id_pedido = ?`;

  const [pedidos] = await executor.query<RowDataPacket[]>(sqlPedido, [idPedido]);
  const p = pedidos[0];
  if (!p) return null;

  const [itens] = await executor.query<RowDataPacket[]>(
    `SELECT 
       ip.id_item_pedido,
       ip.id_pedido,
       ip.id_produto,
       prod.nome_produto,
       ip.tipo_produto,
       prod.unidade_medida,
       ip.quantidade,
       ip.preco_unitario,
       ip.subtotal
     FROM item_pedido ip
     JOIN produtos prod ON prod.id_produto = ip.id_produto
     WHERE ip.id_pedido = ?
     ORDER BY ip.id_item_pedido ASC`,
    [idPedido]
  );

  const [agendamentos] = await executor.query<RowDataPacket[]>(
    `SELECT id_pedido, tipo_pedido, tipo_atendimento, data_hora_agendada, endereco_entrega, observacao
     FROM agendamentos WHERE id_pedido = ?`,
    [idPedido]
  );

  const [historico] = await executor.query<RowDataPacket[]>(
    `SELECT id_historico, id_pedido, tipo_evento, status_anterior, status_novo, valor_historico, descricao_historico, data_historico
     FROM historico_pedidos WHERE id_pedido = ? ORDER BY id_historico DESC`,
    [idPedido]
  );

  const valorTotal = Number(p.valor_total);
  const taxaEntrega = Number(p.taxa_entrega);
  const valorRecebido = p.status_pagamento === 'CONFIRMADO' ? Number(p.valor_pagamento) : 0;
  const valorEmAberto = Math.max(0, Math.round((valorTotal - valorRecebido) * 100) / 100);

  return {
    id_pedido: Number(p.id_pedido),
    numero_exibicao: formatarNumeroExibicao(Number(p.id_pedido)),
    id_cliente: p.id_cliente ? Number(p.id_cliente) : null,
    nome_cliente: p.nome_cliente ?? null,
    telefone_cliente: p.telefone_cliente ?? null,
    data_pedido: p.data_pedido,
    tipo_pedido: p.tipo_pedido,
    status_pedido: p.status_pedido,
    status_financeiro: determinarStatusFinanceiro(p.status_pagamento ?? null),
    observacao: p.observacao,
    taxa_entrega: taxaEntrega,
    valor_itens: Math.round((valorTotal - taxaEntrega) * 100) / 100,
    valor_total: valorTotal,
    valor_recebido: valorRecebido,
    valor_em_aberto: valorEmAberto,
    itens: itens.map((it) => ({
      id_item_pedido: Number(it.id_item_pedido),
      id_pedido: Number(it.id_pedido),
      id_produto: Number(it.id_produto),
      nome_produto: it.nome_produto,
      tipo_produto: it.tipo_produto,
      unidade_medida: it.unidade_medida,
      quantidade: Number(it.quantidade),
      preco_unitario: Number(it.preco_unitario),
      subtotal: Number(it.subtotal)
    })),
    agendamento: agendamentos[0]
      ? {
          id_pedido: Number(agendamentos[0].id_pedido),
          tipo_pedido: agendamentos[0].tipo_pedido,
          tipo_atendimento: agendamentos[0].tipo_atendimento,
          data_hora_agendada: agendamentos[0].data_hora_agendada,
          endereco_entrega: agendamentos[0].endereco_entrega,
          observacao: agendamentos[0].observacao
        }
      : null,
    pagamento: p.id_pagamento
      ? {
          id_pagamento: Number(p.id_pagamento),
          id_pedido: Number(p.id_pedido),
          valor_pagamento: Number(p.valor_pagamento),
          data_pagamento: p.data_pagamento,
          forma_pagamento: p.forma_pagamento,
          status_pagamento: p.status_pagamento,
          observacao: p.obs_pagamento
        }
      : null,
    historico: historico.map((h) => ({
      id_historico: Number(h.id_historico),
      id_pedido: Number(h.id_pedido),
      tipo_evento: h.tipo_evento,
      status_anterior: h.status_anterior,
      status_novo: h.status_novo,
      valor_historico: h.valor_historico !== null ? Number(h.valor_historico) : null,
      descricao_historico: h.descricao_historico,
      data_historico: h.data_historico
    }))
  };
}

export async function listarPedidos(filtro: FiltroPedidos) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filtro.status) {
    where.push('p.status_pedido = ?');
    params.push(filtro.status);
  } else {
    where.push("p.status_pedido NOT IN ('CONCLUIDO', 'CANCELADO')");
  }

  if (filtro.tipo) {
    where.push('p.tipo_pedido = ?');
    params.push(filtro.tipo);
  }
  if (filtro.id_cliente) {
    where.push('p.id_cliente = ?');
    params.push(filtro.id_cliente);
  }
  if (filtro.de) {
    where.push('p.data_pedido >= ?');
    params.push(filtro.de);
  }
  if (filtro.ate) {
    where.push('p.data_pedido < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(filtro.ate);
  }

  if (filtro.termo_busca) {
    const limpo = filtro.termo_busca.replace(/^#/, '');
    const num = Number(limpo);
    if (Number.isInteger(num) && num > 0) {
      where.push('(p.id_pedido = ? OR c.nome_cliente LIKE ?)');
      params.push(num, `%${filtro.termo_busca}%`);
    } else {
      where.push('c.nome_cliente LIKE ?');
      params.push(`%${filtro.termo_busca}%`);
    }
  }

  const limite = filtro.limite && filtro.limite > 0 ? filtro.limite : 50;
  const pagina = filtro.pagina && filtro.pagina > 0 ? filtro.pagina : 1;
  const offset = (pagina - 1) * limite;

  const sql = `
    SELECT 
      p.id_pedido,
      p.id_cliente,
      c.nome_cliente,
      c.telefone_cliente,
      p.data_pedido,
      p.tipo_pedido,
      p.status_pedido,
      p.valor_total,
      p.taxa_entrega,
      p.observacao,
      pg.status_pagamento,
      COALESCE(CASE WHEN pg.status_pagamento = 'CONFIRMADO' THEN pg.valor_pagamento ELSE 0 END, 0) AS valor_recebido,
      ag.tipo_atendimento,
      ag.data_hora_agendada
    FROM pedidos p
    LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
    LEFT JOIN pagamentos pg pg.id_pedido = p.id_pedido
    LEFT JOIN agendamentos ag ag.id_pedido = p.id_pedido
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.data_pedido DESC, p.id_pedido DESC
    LIMIT ? OFFSET ?
  `;

  // Ajuste fino na query acima (removendo sintaxe quebrada caso houvesse)
  const sqlFixed = `
    SELECT 
      p.id_pedido,
      p.id_cliente,
      c.nome_cliente,
      c.telefone_cliente,
      p.data_pedido,
      p.tipo_pedido,
      p.status_pedido,
      p.valor_total,
      p.taxa_entrega,
      p.observacao,
      pg.status_pagamento,
      COALESCE(CASE WHEN pg.status_pagamento = 'CONFIRMADO' THEN pg.valor_pagamento ELSE 0 END, 0) AS valor_recebido,
      ag.tipo_atendimento,
      ag.data_hora_agendada
    FROM pedidos p
    LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
    LEFT JOIN pagamentos pg ON pg.id_pedido = p.id_pedido
    LEFT JOIN agendamentos ag ON ag.id_pedido = p.id_pedido
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.data_pedido DESC, p.id_pedido DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query<RowDataPacket[]>(sqlFixed, [...params, limite, offset]);
  return rows.map((r) => {
    const total = Number(r.valor_total);
    const taxa = Number(r.taxa_entrega);
    const recebido = Number(r.valor_recebido);
    return {
      id_pedido: Number(r.id_pedido),
      numero_exibicao: formatarNumeroExibicao(Number(r.id_pedido)),
      id_cliente: r.id_cliente ? Number(r.id_cliente) : null,
      nome_cliente: r.nome_cliente ?? null,
      telefone_cliente: r.telefone_cliente ?? null,
      data_pedido: r.data_pedido,
      tipo_pedido: r.tipo_pedido,
      status_pedido: r.status_pedido,
      status_financeiro: determinarStatusFinanceiro(r.status_pagamento ?? null),
      valor_total: total,
      taxa_entrega: taxa,
      valor_recebido: recebido,
      valor_em_aberto: Math.max(0, Math.round((total - recebido) * 100) / 100),
      tipo_atendimento: r.tipo_atendimento ?? null,
      data_hora_agendada: r.data_hora_agendada ?? null,
      observacao: r.observacao
    };
  });
}
