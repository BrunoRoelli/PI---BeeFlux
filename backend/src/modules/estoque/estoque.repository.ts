import type { Estoque } from "./estoque.types";
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
// Ajuste SOMENTE este import se seu pool estiver em outro caminho.
import { pool } from '../../database/connection';
import type { CadastroProduto, NovoLote, TipoProduto, TipoMovimentacao } from './estoque.types';

export async function listarEstoque(tipo?: TipoProduto) {
  const sql = `SELECT p.id_produto, p.nome_produto, p.tipo_produto, p.unidade_medida,
    p.estoque_minimo,
    COALESCE(SUM(CASE WHEN l.data_validade IS NULL OR l.data_validade >= CURDATE()
      THEN l.quantidade_atual ELSE 0 END),0) AS saldo_atual
    FROM produtos p LEFT JOIN lotes_estoque l ON l.id_produto = p.id_produto
    WHERE p.ativo = 1 ${tipo ? 'AND p.tipo_produto = ?' : ''}
    GROUP BY p.id_produto, p.nome_produto, p.tipo_produto, p.unidade_medida, p.estoque_minimo
    ORDER BY p.nome_produto`;
  const [rows] = await pool.query<RowDataPacket[]>(sql, tipo ? [tipo] : []);
  return rows.map(r => ({ ...r, saldo_atual: Number(r.saldo_atual),
    estoque_minimo: Number(r.estoque_minimo),
    alerta_minimo: Number(r.saldo_atual) < Number(r.estoque_minimo) }));
}

export async function listarLotes(idProduto: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_lote, id_produto, codigo_lote, quantidade_inicial, quantidade_atual,
      DATE_FORMAT(data_validade, '%Y-%m-%d') AS data_validade, data_entrada,
      (data_validade IS NOT NULL AND data_validade < CURDATE()) AS vencido
     FROM lotes_estoque WHERE id_produto = ? ORDER BY data_validade, id_lote`, [idProduto]);
  return rows;
}

export async function cadastrarProduto(d: CadastroProduto) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO produtos (nome_produto, tipo_produto, unidade_medida, preco_produto,
       estoque_minimo, descricao_produto, marca, id_categoria)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.nome_produto, d.tipo_produto, d.unidade_medida, d.preco_produto ?? 0,
       d.estoque_minimo ?? 0, d.descricao_produto ?? null, d.marca ?? null,
       d.id_categoria ?? null]);
    if (d.tipo_produto === 'FEITO') {
      await conn.execute('INSERT INTO feitos (id_produto) VALUES (?)', [result.insertId]);
    }
    await conn.commit();
    return { id_produto: result.insertId };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

export async function executarTransacao<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const result = await fn(conn); await conn.commit(); return result; }
  catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

export async function buscarProduto(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id_produto, tipo_produto FROM produtos WHERE id_produto = ? AND ativo = 1 FOR UPDATE', [id]);
  return rows[0] as { id_produto: number; tipo_produto: TipoProduto } | undefined;
}

export async function buscarLote(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_lote, id_produto, tipo_produto, quantidade_atual,
      data_validade, (data_validade IS NOT NULL AND data_validade < CURDATE()) AS vencido
     FROM lotes_estoque WHERE id_lote = ? FOR UPDATE`, [id]);
  return rows[0] as { id_lote: number; id_produto: number; tipo_produto: TipoProduto;
    quantidade_atual: string; vencido: number } | undefined;
}

export async function inserirLote(conn: PoolConnection, produto: { id_produto: number; tipo_produto: TipoProduto }, d: NovoLote) {
  const [r] = await conn.execute<ResultSetHeader>(
    `INSERT INTO lotes_estoque (id_produto, tipo_produto, codigo_lote,
       quantidade_inicial, quantidade_atual, data_validade)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [produto.id_produto, produto.tipo_produto, d.codigo_lote ?? null,
      d.quantidade, d.quantidade, d.data_validade ?? null]);
  return r.insertId;
}

export async function atualizarLote(conn: PoolConnection, idLote: number, quantidade: number) {
  await conn.execute('UPDATE lotes_estoque SET quantidade_atual = ? WHERE id_lote = ?', [quantidade, idLote]);
}

export async function registrarMovimentacao(conn: PoolConnection, d: {
  id_produto: number; tipo_produto: TipoProduto; id_lote: number;
  tipo_movimentacao: TipoMovimentacao; quantidade: number; motivo?: string; id_user?: number;
}) {
  const [r] = await conn.execute<ResultSetHeader>(
    `INSERT INTO movimentacoes_estoque
      (id_produto, tipo_produto, id_lote, tipo_movimentacao, quantidade, motivo, id_user)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [d.id_produto, d.tipo_produto, d.id_lote, d.tipo_movimentacao,
      d.quantidade, d.motivo ?? null, d.id_user ?? null]);
  return r.insertId;
}
