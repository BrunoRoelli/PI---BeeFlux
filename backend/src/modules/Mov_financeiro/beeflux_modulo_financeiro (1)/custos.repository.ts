import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/connection';
import type {
  CriarDespesaInput,
  CriarRetiradaInput,
  FiltroFinanceiro,
  MovimentacaoFinanceira
} from './custos.types';

interface MovimentacaoRow extends RowDataPacket {
  data_mov: Date | string;
  tipo: 'ENTRADA' | 'SAIDA';
  categoria: string;
  valor: number | string;
  origem: string;
  id_referencia: number;
  id_pedido: number | null;
}

export async function listarMovimentacoes(filtro: FiltroFinanceiro): Promise<MovimentacaoFinanceira[]> {
  const where: string[] = [];
  const params: Array<string> = [];

  if (filtro.de) { where.push('data_mov >= ?'); params.push(`${filtro.de} 00:00:00`); }
  if (filtro.ate) { where.push('data_mov < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(filtro.ate); }
  if (filtro.tipo) { where.push('tipo = ?'); params.push(filtro.tipo); }
  if (filtro.categoria) { where.push('categoria = ?'); params.push(filtro.categoria); }

  const sql = `SELECT data_mov, tipo, categoria, valor, origem, id_referencia, id_pedido
    FROM vw_movimentacoes_financeiras
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY data_mov DESC, id_referencia DESC`;

  const [rows] = await pool.query<MovimentacaoRow[]>(sql, params);
  return rows.map(row => ({
    data_mov: row.data_mov,
    tipo: row.tipo,
    categoria: row.categoria,
    valor: Number(row.valor),
    origem: row.origem,
    id_referencia: Number(row.id_referencia),
    id_pedido: row.id_pedido === null ? null : Number(row.id_pedido)
  }));
}

export async function obterResumo(de?: string, ate?: string) {
  const where: string[] = [];
  const params: string[] = [];
  if (de) { where.push('data_mov >= ?'); params.push(`${de} 00:00:00`); }
  if (ate) { where.push('data_mov < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(ate); }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) AS total_entradas,
       COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) AS total_saidas,
       COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor WHEN tipo = 'SAIDA' THEN -valor ELSE 0 END), 0) AS saldo_periodo,
       COUNT(*) AS quantidade_movimentacoes
     FROM vw_movimentacoes_financeiras
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params
  );

  const row = rows[0] ?? {};
  return {
    total_entradas: Number(row.total_entradas ?? 0),
    total_saidas: Number(row.total_saidas ?? 0),
    saldo_periodo: Number(row.saldo_periodo ?? 0),
    quantidade_movimentacoes: Number(row.quantidade_movimentacoes ?? 0)
  };
}

export async function listarDespesas(status?: 'PENDENTE' | 'PAGO') {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_despesa, descricao_despesa, categoria_despesa, valor_despesa,
       DATE_FORMAT(data_despesa, '%Y-%m-%d') AS data_despesa,
       DATE_FORMAT(data_vencimento, '%Y-%m-%d') AS data_vencimento,
       status_pagamento, observacao
     FROM despesas
     ${status ? 'WHERE status_pagamento = ?' : ''}
     ORDER BY (status_pagamento = 'PENDENTE') DESC, data_vencimento ASC, data_despesa DESC`,
    status ? [status] : []
  );
  return rows.map(row => ({ ...row, valor_despesa: Number(row.valor_despesa) }));
}

export async function criarDespesa(dados: CriarDespesaInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO despesas
      (descricao_despesa, categoria_despesa, valor_despesa, data_despesa,
       data_vencimento, status_pagamento, observacao)
     VALUES (?, ?, ?, ?, ?, 'PENDENTE', ?)`,
    [dados.descricao_despesa, dados.categoria_despesa, dados.valor_despesa,
     dados.data_despesa, dados.data_vencimento ?? null, dados.observacao ?? null]
  );
  return { id_despesa: result.insertId };
}

export async function marcarDespesaComoPaga(idDespesa: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE despesas SET status_pagamento = 'PAGO'
     WHERE id_despesa = ? AND status_pagamento = 'PENDENTE'`,
    [idDespesa]
  );
  return result.affectedRows;
}

export async function criarRetirada(dados: CriarRetiradaInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO retiradas (id_user, valor_retirada, data_retirada, descricao_retirada)
     VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)`,
    [dados.id_user, dados.valor_retirada, dados.data_retirada ?? null, dados.descricao_retirada ?? null]
  );
  return { id_retirada: result.insertId };
}
