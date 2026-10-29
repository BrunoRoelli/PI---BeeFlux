import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../database/connection';
import type {
  CadastroProduto,
  NovoLote,
  TipoProduto,
  TipoMovimentacao,
  ProdutoEstoque,
  Produto,
  FiltroMovimentacao
} from './estoque.types';
import { paginacaoSegura } from './estoque.regras';

export async function listarEstoque(tipo?: TipoProduto): Promise<ProdutoEstoque[]> {
  const sql = `
    SELECT 
      p.id_produto, 
      p.nome_produto, 
      p.tipo_produto, 
      p.unidade_medida, 
      p.estoque_minimo,
      CASE 
        WHEN p.tipo_produto = 'FEITO' THEN COALESCE(ef.quantidade_atual, 0)
        ELSE COALESCE(ls.saldo_valido, 0) 
      END AS saldo_atual,
      CASE 
        WHEN p.tipo_produto = 'FEITO' THEN COALESCE(ef.quantidade_atual, 0)
        ELSE COALESCE(ls.saldo_fisico, 0) 
      END AS saldo_fisico,
      COALESCE(rv.reservado, 0) AS reservado
    FROM produtos p
    LEFT JOIN (
      SELECT 
        id_produto,
        SUM(CASE WHEN data_validade IS NULL OR data_validade >= CURDATE() THEN quantidade_atual ELSE 0 END) AS saldo_valido,
        SUM(quantidade_atual) AS saldo_fisico
      FROM lotes_estoque 
      GROUP BY id_produto
    ) ls ON ls.id_produto = p.id_produto
    LEFT JOIN estoque_feitos ef ON ef.id_produto_feito = p.id_produto
    LEFT JOIN (
      SELECT id_produto, SUM(quantidade_reservada - quantidade_consumida) AS reservado
      FROM reservas_estoque 
      WHERE status_reserva = 'ATIVA'
      GROUP BY id_produto
    ) rv ON rv.id_produto = p.id_produto
    WHERE p.ativo = 1 ${tipo ? 'AND p.tipo_produto = ?' : ''}
    ORDER BY p.nome_produto`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, tipo ? [tipo] : []);
  return rows.map((r) => {
    const saldo = Number(r.saldo_atual);
    const fisico = Number(r.saldo_fisico);
    const minimo = Number(r.estoque_minimo);
    const reservado = Number(r.reservado);
    const disponivel = Math.max(0, Math.round((saldo - reservado) * 1000) / 1000);
    return {
      id_produto: Number(r.id_produto),
      nome_produto: r.nome_produto,
      tipo_produto: r.tipo_produto,
      unidade_medida: r.unidade_medida,
      estoque_minimo: minimo,
      saldo_atual: saldo,
      saldo_fisico: fisico,
      saldo_disponivel: disponivel,
      controla_estoque: true,
      alerta_minimo: disponivel < minimo,
      alerta_excesso: minimo > 0 && saldo > minimo * 3
    };
  });
}

export async function listarLotes(idProduto: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       id_lote, 
       id_produto, 
       id_item_compra, 
       codigo_lote, 
       quantidade_inicial, 
       quantidade_atual,
       DATE_FORMAT(data_validade, '%Y-%m-%d') AS data_validade, 
       data_entrada,
       (data_validade IS NOT NULL AND data_validade < CURDATE()) AS vencido
     FROM lotes_estoque 
     WHERE id_produto = ?
     ORDER BY (data_validade IS NULL), data_validade, id_lote`,
    [idProduto]
  );
  return rows;
}

export async function listarMovimentacoes(f: FiltroMovimentacao) {
  const { limite, offset } = paginacaoSegura(f.pagina, f.limite);
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (f.id_produto !== undefined) {
    where.push('u.id_produto = ?');
    params.push(f.id_produto);
  }
  if (f.tipo !== undefined) {
    where.push('u.tipo_movimentacao = ?');
    params.push(f.tipo);
  }
  if (f.de !== undefined) {
    where.push('u.data_movimentacao >= ?');
    params.push(f.de);
  }
  if (f.ate !== undefined) {
    where.push('u.data_movimentacao < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(f.ate);
  }

  const sqlUnion = `
    SELECT * FROM (
      SELECT 
        m.id_movimentacao,
        m.id_produto,
        p.nome_produto,
        m.tipo_produto,
        m.id_lote,
        l.codigo_lote,
        m.id_item_compra,
        m.id_pedido,
        m.id_user,
        m.tipo_movimentacao,
        m.quantidade,
        m.motivo,
        m.data_movimentacao,
        NULL AS id_producao
      FROM movimentacoes_estoque m
      JOIN produtos p ON p.id_produto = m.id_produto
      LEFT JOIN lotes_estoque l ON l.id_lote = m.id_lote

      UNION ALL

      SELECT 
        mf.id_movimentacao_feito AS id_movimentacao,
        mf.id_produto_feito AS id_produto,
        p.nome_produto,
        'FEITO' AS tipo_produto,
        NULL AS id_lote,
        NULL AS codigo_lote,
        NULL AS id_item_compra,
        mf.id_pedido,
        NULL AS id_user,
        mf.tipo_movimentacao,
        mf.quantidade,
        mf.motivo,
        mf.criado_em AS data_movimentacao,
        mf.id_producao
      FROM movimentacoes_feitos mf
      JOIN produtos p ON p.id_produto = mf.id_produto_feito
    ) u
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY u.data_movimentacao DESC, u.id_movimentacao DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query<RowDataPacket[]>(sqlUnion, [...params, limite, offset]);
  return rows;
}

export async function quantidadesEmCompra(): Promise<Map<number, number>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ic.id_produto, SUM(ic.quantidade) AS quantidade
     FROM itens_compra ic 
     JOIN compras c ON c.id_compra = ic.id_compra
     WHERE c.status_compra = 'PENDENTE' 
     GROUP BY ic.id_produto`
  );
  return new Map(rows.map((r) => [Number(r.id_produto), Number(r.quantidade)]));
}

export async function categoriaAtiva(idCategoria: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM categorias WHERE id_categoria = ? AND ativo = 1',
    [idCategoria]
  );
  return rows.length > 0;
}

export async function obterProduto(id: number): Promise<Produto | undefined> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_produto, id_categoria, nome_produto, descricao_produto, marca, tipo_produto,
       unidade_medida, preco_produto, estoque_minimo, ativo
     FROM produtos WHERE id_produto = ?`,
    [id]
  );
  const r = rows[0];
  if (!r) return undefined;
  return {
    id_produto: r.id_produto,
    id_categoria: r.id_categoria,
    nome_produto: r.nome_produto,
    descricao_produto: r.descricao_produto,
    marca: r.marca,
    tipo_produto: r.tipo_produto,
    unidade_medida: r.unidade_medida,
    preco_produto: Number(r.preco_produto),
    estoque_minimo: Number(r.estoque_minimo),
    ativo: Boolean(r.ativo)
  };
}

export async function cadastrarProduto(d: CadastroProduto) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const preco = d.tipo_produto === 'INGREDIENTE' ? 0 : (d.preco_produto ?? 0);
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO produtos (nome_produto, tipo_produto, unidade_medida, preco_produto,
       estoque_minimo, descricao_produto, marca, id_categoria)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.nome_produto,
        d.tipo_produto,
        d.unidade_medida,
        preco,
        d.estoque_minimo ?? 0,
        d.descricao_produto ?? null,
        d.marca ?? null,
        d.id_categoria ?? null
      ]
    );

    if (d.tipo_produto === 'FEITO') {
      await conn.execute('INSERT INTO feitos (id_produto, tipo_produto) VALUES (?, "FEITO")', [result.insertId]);
      await conn.execute('INSERT INTO estoque_feitos (id_produto_feito, quantidade_atual) VALUES (?, 0)', [result.insertId]);
    }

    await conn.commit();
    return { id_produto: result.insertId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

const COLUNAS_EDITAVEIS = [
  'nome_produto',
  'descricao_produto',
  'marca',
  'unidade_medida',
  'preco_produto',
  'estoque_minimo',
  'id_categoria'
] as const;

export type CamposProduto = Partial<Record<typeof COLUNAS_EDITAVEIS[number], string | number | null>>;

export async function atualizarProduto(id: number, campos: CamposProduto): Promise<void> {
  const sets: string[] = [];
  const valores: Array<string | number | null> = [];

  for (const coluna of COLUNAS_EDITAVEIS) {
    const v = campos[coluna];
    if (v !== undefined) {
      sets.push(`${coluna} = ?`);
      valores.push(v);
    }
  }

  if (sets.length === 0) return;
  valores.push(id);
  await pool.execute(`UPDATE produtos SET ${sets.join(', ')} WHERE id_produto = ?`, valores);
}

export async function saldoFisicoTotalProduto(idProduto: number): Promise<number> {
  const [rowsLotes] = await pool.query<RowDataPacket[]>(
    'SELECT COALESCE(SUM(quantidade_atual), 0) AS saldo FROM lotes_estoque WHERE id_produto = ?',
    [idProduto]
  );
  const [rowsFeitos] = await pool.query<RowDataPacket[]>(
    'SELECT COALESCE(quantidade_atual, 0) AS saldo FROM estoque_feitos WHERE id_produto_feito = ?',
    [idProduto]
  );
  return Number(rowsLotes[0]?.saldo ?? 0) + Number(rowsFeitos[0]?.saldo ?? 0);
}

export async function reservasAtivasProduto(idProduto: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(quantidade_reservada - quantidade_consumida), 0) AS total
     FROM reservas_estoque WHERE id_produto = ? AND status_reserva = 'ATIVA'`,
    [idProduto]
  );
  return Number(rows[0]?.total ?? 0);
}

export async function desativarProduto(idProduto: number): Promise<void> {
  await pool.execute('UPDATE produtos SET ativo = 0 WHERE id_produto = ?', [idProduto]);
}

export async function executarTransacao<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function buscarProduto(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_produto, tipo_produto, nome_produto FROM produtos WHERE id_produto = ? AND ativo = 1 FOR UPDATE',
    [id]
  );
  return rows[0] as { id_produto: number; tipo_produto: TipoProduto; nome_produto: string } | undefined;
}

export async function buscarLote(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_lote, id_produto, tipo_produto, quantidade_inicial, quantidade_atual,
       (data_validade IS NOT NULL AND data_validade < CURDATE()) AS vencido
     FROM lotes_estoque WHERE id_lote = ? FOR UPDATE`,
    [id]
  );
  return rows[0] as
    | {
        id_lote: number;
        id_produto: number;
        tipo_produto: TipoProduto;
        quantidade_inicial: string;
        quantidade_atual: string;
        vencido: number;
      }
    | undefined;
}

export async function inserirLote(
  conn: PoolConnection,
  produto: { id_produto: number; tipo_produto: TipoProduto },
  d: Pick<NovoLote, 'quantidade' | 'codigo_lote' | 'data_validade' | 'id_item_compra'>
) {
  const [r] = await conn.execute<ResultSetHeader>(
    `INSERT INTO lotes_estoque (id_produto, tipo_produto, id_item_compra, codigo_lote,
       quantidade_inicial, quantidade_atual, data_validade)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      produto.id_produto,
      produto.tipo_produto,
      d.id_item_compra ?? null,
      d.codigo_lote ?? null,
      d.quantidade,
      d.quantidade,
      d.data_validade ?? null
    ]
  );
  return r.insertId;
}

export async function atualizarLote(conn: PoolConnection, idLote: number, quantidade: number) {
  await conn.execute('UPDATE lotes_estoque SET quantidade_atual = ? WHERE id_lote = ?', [quantidade, idLote]);
}

export async function registrarMovimentacao(
  conn: PoolConnection,
  d: {
    id_produto: number;
    tipo_produto: TipoProduto;
    id_lote?: number | null;
    tipo_movimentacao: TipoMovimentacao;
    quantidade: number;
    motivo?: string;
    id_user?: number;
    id_item_compra?: number;
    id_pedido?: number;
  }
) {
  const [r] = await conn.execute<ResultSetHeader>(
    `INSERT INTO movimentacoes_estoque
      (id_produto, tipo_produto, id_lote, id_item_compra, id_pedido, id_user,
       tipo_movimentacao, quantidade, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.id_produto,
      d.tipo_produto,
      d.id_lote ?? null,
      d.id_item_compra ?? null,
      d.id_pedido ?? null,
      d.id_user ?? null,
      d.tipo_movimentacao,
      d.quantidade,
      d.motivo ?? null
    ]
  );
  return r.insertId;
}

export async function buscarLotesFEFO(conn: PoolConnection, idProduto: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_lote, id_produto, tipo_produto, quantidade_atual,
       (data_validade IS NOT NULL AND data_validade < CURDATE()) AS vencido
     FROM lotes_estoque 
     WHERE id_produto = ? AND quantidade_atual > 0
     ORDER BY vencido ASC, (data_validade IS NULL) ASC, data_validade ASC,
              data_entrada ASC, id_lote ASC
     FOR UPDATE`,
    [idProduto]
  );
  return rows as Array<RowDataPacket & { id_lote: number; quantidade_atual: string; vencido: number }>;
}

export async function buscarCompra(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_compra, status_compra FROM compras WHERE id_compra = ? FOR UPDATE',
    [id]
  );
  return rows[0] as { id_compra: number; status_compra: 'PENDENTE' | 'RECEBIDA' | 'CANCELADA' } | undefined;
}

export async function itensDaCompra(conn: PoolConnection, idCompra: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_item_compra, id_produto, tipo_produto, quantidade 
     FROM itens_compra 
     WHERE id_compra = ? 
     ORDER BY id_item_compra`,
    [idCompra]
  );
  return rows as Array<
    RowDataPacket & {
      id_item_compra: number;
      id_produto: number;
      tipo_produto: TipoProduto;
      quantidade: string;
    }
  >;
}

export async function marcarCompraRecebida(conn: PoolConnection, idCompra: number) {
  await conn.execute("UPDATE compras SET status_compra = 'RECEBIDA' WHERE id_compra = ?", [idCompra]);
}

export async function buscarPedido(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_pedido, status_pedido FROM pedidos WHERE id_pedido = ? FOR UPDATE',
    [id]
  );
  return rows[0] as { id_pedido: number; status_pedido: string } | undefined;
}

export async function itensDoPedido(conn: PoolConnection, idPedido: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_produto, tipo_produto, quantidade 
     FROM item_pedido 
     WHERE id_pedido = ? 
     ORDER BY id_produto`,
    [idPedido]
  );
  return rows as Array<
    RowDataPacket & {
      id_produto: number;
      tipo_produto: TipoProduto;
      quantidade: string;
    }
  >;
}

export async function movimentadoPorPedido(conn: PoolConnection, idPedido: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_lote, id_produto, tipo_produto, SUM(quantidade) AS liquido
     FROM movimentacoes_estoque 
     WHERE id_pedido = ?
     GROUP BY id_lote, id_produto, tipo_produto 
     ORDER BY id_lote`,
    [idPedido]
  );
  return rows as Array<
    RowDataPacket & {
      id_lote: number;
      id_produto: number;
      tipo_produto: TipoProduto;
      liquido: string;
    }
  >;
}

export async function movimentadoFeitoPorPedido(conn: PoolConnection, idPedido: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_produto_feito, SUM(quantidade) AS liquido
     FROM movimentacoes_feitos
     WHERE id_pedido = ?
     GROUP BY id_produto_feito`,
    [idPedido]
  );
  return rows as Array<
    RowDataPacket & {
      id_produto_feito: number;
      liquido: string;
    }
  >;
}

export async function obterReceitaProdutoFeito(conn: PoolConnection, idProdutoFeito: number) {
  const [detalhes] = await conn.query<RowDataPacket[]>(
    `SELECT id_produto_feito, tempo_preparo_minutos, rendimento_receita, instrucoes,
            custos_fixos, custo_mao_obra, margem_lucro, status_receita
     FROM detalhes_receita
     WHERE id_produto_feito = ? FOR UPDATE`,
    [idProdutoFeito]
  );
  if (!detalhes[0]) return null;

  const [ingredientes] = await conn.query<RowDataPacket[]>(
    `SELECT ri.id_ingrediente, ri.quantidade, p.nome_produto, p.tipo_produto, p.unidade_medida
     FROM receita_ingrediente ri
     JOIN produtos p ON p.id_produto = ri.id_ingrediente
     WHERE ri.id_produto_feito = ?`,
    [idProdutoFeito]
  );

  return {
    detalhes: detalhes[0] as {
      id_produto_feito: number;
      tempo_preparo_minutos: number;
      rendimento_receita: string;
      instrucoes: string | null;
      custos_fixos: string;
      custo_mao_obra: string;
      margem_lucro: string;
      status_receita: string;
    },
    ingredientes: ingredientes as Array<{
      id_ingrediente: number;
      quantidade: string;
      nome_produto: string;
      tipo_produto: TipoProduto;
      unidade_medida: string;
    }>
  };
}

export async function buscarItemPedidoFeito(conn: PoolConnection, idPedido: number, idFeito: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ip.quantidade, ip.tipo_produto FROM item_pedido ip
     WHERE ip.id_pedido = ? AND ip.id_produto = ? FOR UPDATE`, [idPedido, idFeito]);
  return rows[0] as { quantidade: string; tipo_produto: TipoProduto } | undefined;
}

export async function bloquearEstoqueFeito(conn: PoolConnection, idFeito: number): Promise<number> {
  await conn.execute('INSERT IGNORE INTO estoque_feitos (id_produto_feito, quantidade_atual) VALUES (?, 0)', [idFeito]);
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT quantidade_atual FROM estoque_feitos WHERE id_produto_feito = ? FOR UPDATE',
    [idFeito]
  );
  return Number(rows[0]?.quantidade_atual ?? 0);
}

export async function atualizarEstoqueFeito(conn: PoolConnection, idFeito: number, saldo: number) {
  await conn.execute('UPDATE estoque_feitos SET quantidade_atual = ? WHERE id_produto_feito = ?', [saldo, idFeito]);
}

export async function movimentarFeito(
  conn: PoolConnection,
  d: {
    id_produto_feito: number;
    id_producao?: number;
    id_pedido?: number;
    tipo_movimentacao: TipoMovimentacao;
    quantidade: number;
    motivo?: string;
  }
) {
  await conn.execute(
    `INSERT INTO movimentacoes_feitos
      (id_produto_feito, id_producao, id_pedido, tipo_movimentacao, quantidade, motivo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      d.id_produto_feito,
      d.id_producao ?? null,
      d.id_pedido ?? null,
      d.tipo_movimentacao,
      d.quantidade,
      d.motivo ?? null
    ]
  );
}

export async function criarReserva(
  conn: PoolConnection,
  d: { id_pedido: number; id_produto: number; quantidade: number }
) {
  const [res] = await conn.execute<ResultSetHeader>(
    `INSERT INTO reservas_estoque (id_pedido, id_produto, quantidade_reservada, quantidade_consumida, status_reserva)
     VALUES (?, ?, ?, 0, 'ATIVA')`,
    [d.id_pedido, d.id_produto, d.quantidade]
  );
  return res.insertId;
}

export async function buscarReservasAtivasPedido(conn: PoolConnection, idPedido: number, idProduto?: number) {
  const sql = `
    SELECT id_reserva, id_pedido, id_produto, quantidade_reservada, quantidade_consumida
    FROM reservas_estoque
    WHERE id_pedido = ? AND status_reserva = 'ATIVA' ${idProduto ? 'AND id_produto = ?' : ''}
    FOR UPDATE
  `;
  const [rows] = await conn.query<RowDataPacket[]>(sql, idProduto ? [idPedido, idProduto] : [idPedido]);
  return rows as Array<{
    id_reserva: number;
    id_pedido: number;
    id_produto: number;
    quantidade_reservada: string;
    quantidade_consumida: string;
  }>;
}

export async function consumirReserva(conn: PoolConnection, idReserva: number, quantidadeConsumida: number, finalizada: boolean) {
  await conn.execute(
    `UPDATE reservas_estoque
     SET quantidade_consumida = quantidade_consumida + ?,
         status_reserva = ?
     WHERE id_reserva = ?`,
    [quantidadeConsumida, finalizada ? 'CONSUMIDA' : 'ATIVA', idReserva]
  );
}

export async function liberarReservasPedido(conn: PoolConnection, idPedido: number) {
  await conn.execute(
    `UPDATE reservas_estoque SET status_reserva = 'LIBERADA' WHERE id_pedido = ? AND status_reserva = 'ATIVA'`,
    [idPedido]
  );
}

export async function reservadoProduto(conn: PoolConnection, idProduto: number, excluirPedido?: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(quantidade_reservada - quantidade_consumida), 0) AS reservado
     FROM reservas_estoque 
     WHERE id_produto = ? AND status_reserva = 'ATIVA' AND (? IS NULL OR id_pedido <> ?)`,
    [idProduto, excluirPedido ?? null, excluirPedido ?? null]
  );
  return Number(rows[0]?.reservado ?? 0);
}

export async function inserirPendencia(
  conn: PoolConnection,
  d: {
    id_pedido: number;
    id_producao?: number;
    id_produto: number;
    quantidade: number;
    motivo: string;
  }
) {
  const [res] = await conn.execute<ResultSetHeader>(
    `INSERT INTO pendencias_estoque (id_pedido, id_producao, id_produto, quantidade_pendente, motivo, status_pendencia)
     VALUES (?, ?, ?, ?, ?, 'ABERTA')`,
    [d.id_pedido, d.id_producao ?? null, d.id_produto, d.quantidade, d.motivo]
  );
  return res.insertId;
}

export async function registrarHistoricoPedido(
  conn: PoolConnection,
  d: {
    id_pedido: number;
    tipo_evento: 'CRIACAO' | 'ALTERACAO_VALOR' | 'ALTERACAO_STATUS' | 'CANCELAMENTO' | 'CONCLUSAO' | 'OUTRO';
    status_anterior?: string | null;
    status_novo?: string | null;
    valor_historico?: number | null;
    descricao_historico: string;
  }
) {
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

export async function atualizarStatusPedido(conn: PoolConnection, idPedido: number, statusNovo: string) {
  await conn.execute('UPDATE pedidos SET status_pedido = ? WHERE id_pedido = ?', [statusNovo, idPedido]);
}

export async function listarProducoes(idPedido: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_producao, id_pedido, id_produto_feito, quantidade_planejada,
            quantidade_concluida, quantidade_perdida, status_producao,
            receita_snapshot, data_inicio, data_conclusao
     FROM producoes WHERE id_pedido = ? ORDER BY id_producao DESC`,
    [idPedido]
  );
  return rows;
}
