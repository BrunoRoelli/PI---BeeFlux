import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { pool } from '../../database/connection';
import type { SalvarCardapio, ItemCardapioVinculo, CardapioResumo } from './cardapio.types';

export async function transacao<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function listarCardapios(apenasAtivos = false): Promise<CardapioResumo[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_cardapio, nome_cardapio, descricao_cardapio, ativo
     FROM cardapios
     ${apenasAtivos ? 'WHERE ativo = 1' : ''}
     ORDER BY nome_cardapio`
  );
  return rows.map((r) => ({
    id_cardapio: Number(r.id_cardapio),
    nome_cardapio: String(r.nome_cardapio),
    descricao_cardapio: r.descricao_cardapio ? String(r.descricao_cardapio) : null,
    ativo: Boolean(r.ativo)
  }));
}

export async function obterCardapioPorId(idCardapio: number, apenasAtivo = false): Promise<CardapioResumo | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_cardapio, nome_cardapio, descricao_cardapio, ativo
     FROM cardapios
     WHERE id_cardapio = ? ${apenasAtivo ? 'AND ativo = 1' : ''}`,
    [idCardapio]
  );
  if (!rows.length) return null;
  const r = rows[0]!;
  return {
    id_cardapio: Number(r.id_cardapio),
    nome_cardapio: String(r.nome_cardapio),
    descricao_cardapio: r.descricao_cardapio ? String(r.descricao_cardapio) : null,
    ativo: Boolean(r.ativo)
  };
}

export async function criarCardapio(d: SalvarCardapio): Promise<number> {
  const [r] = await pool.execute<ResultSetHeader>(
    'INSERT INTO cardapios (nome_cardapio, descricao_cardapio, ativo) VALUES (?, ?, ?)',
    [d.nome_cardapio.trim(), d.descricao_cardapio ?? null, d.ativo === false ? 0 : 1]
  );
  return r.insertId;
}

export async function atualizarCardapio(idCardapio: number, d: SalvarCardapio): Promise<boolean> {
  const [r] = await pool.execute<ResultSetHeader>(
    'UPDATE cardapios SET nome_cardapio = ?, descricao_cardapio = ?, ativo = ? WHERE id_cardapio = ?',
    [d.nome_cardapio.trim(), d.descricao_cardapio ?? null, d.ativo === false ? 0 : 1, idCardapio]
  );
  return r.affectedRows > 0;
}

export async function buscarProdutoBase(conn: PoolConnection, idProduto: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_produto, nome_produto, tipo_produto, ativo, preco_produto
     FROM produtos
     WHERE id_produto = ?`,
    [idProduto]
  );
  return rows[0] as
    | {
        id_produto: number;
        nome_produto: string;
        tipo_produto: 'REVENDA' | 'INGREDIENTE' | 'FEITO';
        ativo: number;
        preco_produto: string;
      }
    | undefined;
}

export async function vincularProduto(conn: PoolConnection, idCardapio: number, d: ItemCardapioVinculo) {
  await conn.execute(
    `INSERT INTO cardapio_produto
      (id_cardapio, id_produto, tipo_produto, preco_cardapio, disponivel, ordem_exibicao)
     VALUES (?, ?, (SELECT tipo_produto FROM produtos WHERE id_produto = ?), ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      preco_cardapio = VALUES(preco_cardapio),
      disponivel = VALUES(disponivel),
      ordem_exibicao = VALUES(ordem_exibicao)`,
    [
      idCardapio,
      d.id_produto,
      d.id_produto,
      d.preco_cardapio ?? null,
      d.disponivel === false ? 0 : 1,
      d.ordem_exibicao ?? 0
    ]
  );
}

export async function desvincularProduto(idCardapio: number, idProduto: number): Promise<boolean> {
  const [r] = await pool.execute<ResultSetHeader>(
    'DELETE FROM cardapio_produto WHERE id_cardapio = ? AND id_produto = ?',
    [idCardapio, idProduto]
  );
  return r.affectedRows > 0;
}

export async function alternarDisponibilidadeItem(
  idCardapio: number,
  idProduto: number,
  disponivel: boolean
): Promise<boolean> {
  const [r] = await pool.execute<ResultSetHeader>(
    'UPDATE cardapio_produto SET disponivel = ? WHERE id_cardapio = ? AND id_produto = ?',
    [disponivel ? 1 : 0, idCardapio, idProduto]
  );
  return r.affectedRows > 0;
}

export async function buscarItensCardapioBrutos(idCardapio: number, apenasAtivos = false) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       cp.id_produto,
       p.nome_produto,
       p.descricao_produto,
       p.marca,
       p.tipo_produto,
       p.id_categoria,
       c.nome_categoria,
       p.preco_produto,
       cp.preco_cardapio,
       cp.disponivel AS ativo_cardapio,
       cp.ordem_exibicao
     FROM cardapio_produto cp
     JOIN produtos p ON p.id_produto = cp.id_produto
     LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
     WHERE cp.id_cardapio = ?
       ${apenasAtivos ? 'AND p.ativo = 1 AND cp.disponivel = 1' : ''}
     ORDER BY cp.ordem_exibicao ASC, p.nome_produto ASC`,
    [idCardapio]
  );
  return rows;
}

// Consultas seguras de estoque de apoio sem alterar saldos
export async function buscarSaldosProntos(conn: PoolConnection, idsProdutos: number[]) {
  if (!idsProdutos.length) return new Map<number, number>();

  // 1. Saldo pronto de REVENDA (lotes vigentes menos reservas ativas)
  const [lotes] = await conn.query<RowDataPacket[]>(
    `SELECT 
       p.id_produto,
       COALESCE(ls.saldo_valido, 0) AS saldo_valido,
       COALESCE(rv.reservado, 0) AS reservado
     FROM produtos p
     LEFT JOIN (
       SELECT id_produto,
         SUM(CASE WHEN data_validade IS NULL OR data_validade >= CURDATE() THEN quantidade_atual ELSE 0 END) AS saldo_valido
       FROM lotes_estoque
       WHERE id_produto IN (${idsProdutos.map(() => '?').join(',')})
       GROUP BY id_produto
     ) ls ON ls.id_produto = p.id_produto
     LEFT JOIN (
       SELECT id_produto, SUM(quantidade_reservada - quantidade_consumida) AS reservado
       FROM reservas_estoque
       WHERE status_reserva = 'ATIVA' AND id_produto IN (${idsProdutos.map(() => '?').join(',')})
       GROUP BY id_produto
     ) rv ON rv.id_produto = p.id_produto
     WHERE p.tipo_produto = 'REVENDA' AND p.id_produto IN (${idsProdutos.map(() => '?').join(',')})`,
    [...idsProdutos, ...idsProdutos, ...idsProdutos]
  );

  // 2. Saldo pronto de FEITO (estoque_feitos menos reservas ativas)
  const [feitos] = await conn.query<RowDataPacket[]>(
    `SELECT 
       ef.id_produto_feito AS id_produto,
       ef.quantidade_atual,
       COALESCE(rv.reservado, 0) AS reservado
     FROM estoque_feitos ef
     LEFT JOIN (
       SELECT id_produto, SUM(quantidade_reservada - quantidade_consumida) AS reservado
       FROM reservas_estoque
       WHERE status_reserva = 'ATIVA' AND id_produto IN (${idsProdutos.map(() => '?').join(',')})
       GROUP BY id_produto
     ) rv ON rv.id_produto = ef.id_produto_feito
     WHERE ef.id_produto_feito IN (${idsProdutos.map(() => '?').join(',')})`,
    [...idsProdutos, ...idsProdutos]
  );

  const mapa = new Map<number, number>();
  for (const r of lotes) {
    const disp = Math.max(0, Number(r.saldo_valido) - Number(r.reservado));
    mapa.set(Number(r.id_produto), Math.round(disp * 1000) / 1000);
  }
  for (const r of feitos) {
    const disp = Math.max(0, Number(r.quantidade_atual) - Number(r.reservado));
    mapa.set(Number(r.id_produto), Math.round(disp * 1000) / 1000);
  }
  return mapa;
}

// Busca capacidade de produção de produtos FEITOS através de suas receitas e lotes de ingredientes
export async function buscarCapacidadeProducaoFeitos(conn: PoolConnection, idsFeitos: number[]) {
  if (!idsFeitos.length) return new Map<number, number>();

  const [receitas] = await conn.query<RowDataPacket[]>(
    `SELECT d.id_produto_feito, d.rendimento_receita, d.status_receita
     FROM detalhes_receita d
     WHERE d.id_produto_feito IN (${idsFeitos.map(() => '?').join(',')})
       AND d.status_receita = 'ATIVA'`,
    idsFeitos
  );

  if (!receitas.length) return new Map<number, number>();

  const [ingredientes] = await conn.query<RowDataPacket[]>(
    `SELECT ri.id_produto_feito, ri.id_ingrediente, ri.quantidade
     FROM receita_ingrediente ri
     WHERE ri.id_produto_feito IN (${receitas.map(() => '?').join(',')})`,
    receitas.map((r) => r.id_produto_feito)
  );

  const idsIngredientes = Array.from(new Set(ingredientes.map((i) => Number(i.id_ingrediente))));
  if (!idsIngredientes.length) return new Map<number, number>();

  const [saldosIng] = await conn.query<RowDataPacket[]>(
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

  const mapaIng = new Map<number, number>();
  for (const r of saldosIng) {
    const disp = Math.max(0, Number(r.saldo_valido) - Number(r.reservado));
    mapaIng.set(Number(r.id_produto), Math.round(disp * 1000) / 1000);
  }

  const mapaCapacidade = new Map<number, number>();
  for (const rec of receitas) {
    const idFeito = Number(rec.id_produto_feito);
    const rendimento = Number(rec.rendimento_receita);
    const ings = ingredientes.filter((i) => Number(i.id_produto_feito) === idFeito);

    if (!ings.length || rendimento <= 0) {
      mapaCapacidade.set(idFeito, 0);
      continue;
    }

    let minLotes = Infinity;
    for (const ing of ings) {
      const disp = mapaIng.get(Number(ing.id_ingrediente)) ?? 0;
      const qtdIng = Number(ing.quantidade);
      if (qtdIng <= 0) continue;
      const lotes = disp / qtdIng;
      if (lotes < minLotes) minLotes = lotes;
    }

    const capacidade = minLotes === Infinity || minLotes <= 0 ? 0 : Math.floor(minLotes * rendimento);
    mapaCapacidade.set(idFeito, capacidade);
  }

  return mapaCapacidade;
}
