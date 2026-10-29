import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../database/connection';
import type { SalvarReceita } from './receitas.types';

export async function transacao<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function produto(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_produto, tipo_produto, ativo FROM produtos WHERE id_produto = ? FOR UPDATE',
    [id]
  );
  return rows[0] as { id_produto: number; tipo_produto: string; ativo: number } | undefined;
}

export async function ingredientesCadastrados(conn: PoolConnection, ids: number[]) {
  if (!ids.length) return [];
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_produto, tipo_produto, ativo FROM produtos WHERE id_produto IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  return rows as Array<RowDataPacket & { id_produto: number; tipo_produto: string; ativo: number }>;
}

export async function receita(conn: PoolConnection, id: number) {
  const [detalhes] = await conn.query<RowDataPacket[]>(
    `SELECT id_produto_feito, tempo_preparo_minutos, rendimento_receita, instrucoes,
            custos_fixos, custo_mao_obra, margem_lucro, status_receita
     FROM detalhes_receita
     WHERE id_produto_feito = ?`,
    [id]
  );
  if (!detalhes.length) return null;

  const [itens] = await conn.query<RowDataPacket[]>(
    `SELECT ri.id_ingrediente, ri.quantidade, p.nome_produto, p.unidade_medida
     FROM receita_ingrediente ri
     JOIN produtos p ON p.id_produto = ri.id_ingrediente
     WHERE ri.id_produto_feito = ?
     ORDER BY ri.id_ingrediente`,
    [id]
  );

  return {
    ...detalhes[0],
    tempo_preparo_minutos: Number(detalhes[0]?.tempo_preparo_minutos),
    rendimento_receita: Number(detalhes[0]?.rendimento_receita),
    custos_fixos: Number(detalhes[0]?.custos_fixos),
    custo_mao_obra: Number(detalhes[0]?.custo_mao_obra),
    margem_lucro: Number(detalhes[0]?.margem_lucro),
    ingredientes: itens.map((x) => ({
      id_ingrediente: Number(x.id_ingrediente),
      quantidade: Number(x.quantidade),
      nome_produto: String(x.nome_produto),
      unidade_medida: String(x.unidade_medida)
    }))
  };
}

export async function listar() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT d.id_produto_feito, p.nome_produto, d.rendimento_receita, d.tempo_preparo_minutos, d.status_receita
     FROM detalhes_receita d
     JOIN produtos p ON p.id_produto = d.id_produto_feito
     WHERE p.ativo = 1
     ORDER BY p.nome_produto`
  );
  return rows;
}

export async function salvar(conn: PoolConnection, d: SalvarReceita, atualizar: boolean) {
  if (atualizar) {
    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE detalhes_receita
       SET tempo_preparo_minutos = ?, rendimento_receita = ?, instrucoes = ?, custos_fixos = ?,
           custo_mao_obra = ?, margem_lucro = ?, status_receita = 'ATIVA'
       WHERE id_produto_feito = ?`,
      [
        d.tempo_preparo_minutos,
        d.rendimento_receita,
        d.instrucoes,
        d.custos_fixos,
        d.custo_mao_obra,
        d.margem_lucro,
        d.id_produto_feito
      ]
    );
    if (result.affectedRows === 0) throw new Error('Receita não encontrada.');
    await conn.execute('DELETE FROM receita_ingrediente WHERE id_produto_feito = ?', [d.id_produto_feito]);
  } else {
    // Parâmetro d.instrucoes ajustado com alinhamento das 8 colunas e 7 placeholders + status
    await conn.execute(
      `INSERT INTO detalhes_receita
        (id_produto_feito, tempo_preparo_minutos, rendimento_receita, instrucoes, custos_fixos, custo_mao_obra, margem_lucro, status_receita)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ATIVA')`,
      [
        d.id_produto_feito,
        d.tempo_preparo_minutos,
        d.rendimento_receita,
        d.instrucoes,
        d.custos_fixos,
        d.custo_mao_obra,
        d.margem_lucro
      ]
    );
  }

  for (const i of d.ingredientes) {
    await conn.execute(
      `INSERT INTO receita_ingrediente (id_produto_feito, id_ingrediente, tipo_ingrediente, quantidade)
       VALUES (?, ?, 'INGREDIENTE', ?)`,
      [d.id_produto_feito, i.id_ingrediente, i.quantidade]
    );
  }
}

export async function mudarStatus(conn: PoolConnection, id: number, status: 'ATIVA' | 'INATIVA') {
  const [r] = await conn.execute<ResultSetHeader>(
    'UPDATE detalhes_receita SET status_receita = ? WHERE id_produto_feito = ?',
    [status, id]
  );
  return r.affectedRows;
}

// Busca saldo disponível real (lotes não vencidos menos reservas ativas)
export async function saldosDisponiveisIngredientes(conn: PoolConnection, idsIngredientes: number[]) {
  if (!idsIngredientes.length) return new Map<number, number>();
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT 
       p.id_produto,
       COALESCE(ls.saldo_valido, 0) AS saldo_valido,
       COALESCE(rv.reservado, 0) AS reservado
     FROM produtos p
     LEFT JOIN (
       SELECT id_produto,
         SUM(CASE WHEN data_validade IS NULL OR data_validade >= CURDATE() THEN quantidade_atual ELSE 0 END) AS saldo_valido
       FROM lotes_estoque
       WHERE id_produto IN (${idsIngredientes.map(() => '?').join(',')})
       GROUP BY id_produto
     ) ls ON ls.id_produto = p.id_produto
     LEFT JOIN (
       SELECT id_produto, SUM(quantidade_reservada - quantidade_consumida) AS reservado
       FROM reservas_estoque
       WHERE status_reserva = 'ATIVA' AND id_produto IN (${idsIngredientes.map(() => '?').join(',')})
       GROUP BY id_produto
     ) rv ON rv.id_produto = p.id_produto
     WHERE p.id_produto IN (${idsIngredientes.map(() => '?').join(',')})`,
    [...idsIngredientes, ...idsIngredientes, ...idsIngredientes]
  );

  const mapa = new Map<number, number>();
  for (const r of rows) {
    const disponivel = Math.max(0, Number(r.saldo_valido) - Number(r.reservado));
    mapa.set(Number(r.id_produto), Math.round(disponivel * 1000) / 1000);
  }
  return mapa;
}

// Busca último custo de compra real para precificação automática
export async function custosRecentesIngredientes(conn: PoolConnection, idsIngredientes: number[]) {
  if (!idsIngredientes.length) return new Map<number, number>();
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ic.id_produto, ic.custo_unitario
     FROM itens_compra ic
     JOIN (
       SELECT id_produto, MAX(id_item_compra) AS max_item
       FROM itens_compra
       WHERE id_produto IN (${idsIngredientes.map(() => '?').join(',')})
       GROUP BY id_produto
     ) ult ON ult.max_item = ic.id_item_compra`,
    idsIngredientes
  );

  const mapa = new Map<number, number>();
  for (const r of rows) {
    mapa.set(Number(r.id_produto), Number(r.custo_unitario));
  }
  return mapa;
}

// Consulta de disponibilidade para Cardápio
export async function saldoFeitoPronto(conn: PoolConnection, idProdutoFeito: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT 
       ef.quantidade_atual,
       COALESCE(rv.reservado, 0) AS reservado
     FROM estoque_feitos ef
     LEFT JOIN (
       SELECT id_produto, SUM(quantidade_reservada - quantidade_consumida) AS reservado
       FROM reservas_estoque
       WHERE status_reserva = 'ATIVA' AND id_produto = ?
       GROUP BY id_produto
     ) rv ON rv.id_produto = ef.id_produto_feito
     WHERE ef.id_produto_feito = ?`,
    [idProdutoFeito, idProdutoFeito]
  );
  if (!rows.length) return 0;
  const saldo = Number(rows[0]?.quantidade_atual ?? 0) - Number(rows[0]?.reservado ?? 0);
  return Math.max(0, Math.round(saldo * 1000) / 1000);
}
