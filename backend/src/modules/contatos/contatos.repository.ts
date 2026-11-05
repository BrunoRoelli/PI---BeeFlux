import { pool } from '../../database/connection';
import type { ClienteInput, FornecedorInput } from './contatos.types';

const digits = (value: string) => value.replace(/\D/g, '');

export const contatosRepository = {
  async listarClientes(busca = '', status = 'ativos') {
    const termo = `%${busca}%`;
    const ativo = status === 'todos' ? null : status === 'inativos' ? 0 : 1;
    const [rows] = await pool.execute(
      `SELECT c.id_cliente, c.nome_cliente, c.telefone_cliente, c.email_cliente,
              c.observacao, c.ativo, c.criado_em,
              COUNT(DISTINCT p.id_pedido) AS quantidade_pedidos,
              COALESCE(SUM(CASE WHEN p.status_pedido <> 'CANCELADO' THEN p.valor_total ELSE 0 END), 0) AS total_pedidos
         FROM clientes c
         LEFT JOIN pedidos p ON p.id_cliente = c.id_cliente
        WHERE (c.nome_cliente LIKE ? OR c.telefone_cliente LIKE ?)
          AND (? IS NULL OR c.ativo = ?)
        GROUP BY c.id_cliente
        ORDER BY c.nome_cliente ASC`,
      [termo, termo, ativo, ativo]
    );
    return rows;
  },

  async buscarClientePorId(id: number) {
    const [rows] = await pool.execute(
      `SELECT id_cliente, nome_cliente, telefone_cliente, email_cliente, observacao, ativo, criado_em
         FROM clientes WHERE id_cliente = ? LIMIT 1`, [id]
    );
    return (rows as any[])[0] ?? null;
  },

  async telefoneClienteEmUso(telefone: string, ignorarId?: number) {
    const [rows] = await pool.execute(
      `SELECT id_cliente FROM clientes
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone_cliente, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') = ?
          AND (? IS NULL OR id_cliente <> ?) LIMIT 1`,
      [digits(telefone), ignorarId ?? null, ignorarId ?? null]
    );
    return (rows as any[]).length > 0;
  },

  async criarCliente(input: ClienteInput) {
    const [result] = await pool.execute(
      `INSERT INTO clientes (nome_cliente, telefone_cliente, email_cliente, observacao, ativo)
       VALUES (?, ?, ?, ?, TRUE)`,
      [input.nome.trim(), digits(input.telefone), input.email?.trim() || null, input.observacao?.trim() || null]
    );
    return (result as any).insertId as number;
  },

  async atualizarCliente(id: number, input: ClienteInput) {
    await pool.execute(
      `UPDATE clientes SET nome_cliente = ?, telefone_cliente = ?, email_cliente = ?, observacao = ?
        WHERE id_cliente = ?`,
      [input.nome.trim(), digits(input.telefone), input.email?.trim() || null, input.observacao?.trim() || null, id]
    );
  },

  async alterarStatusCliente(id: number, ativo: boolean) {
    await pool.execute('UPDATE clientes SET ativo = ? WHERE id_cliente = ?', [ativo, id]);
  },

  async historicoCliente(id: number) {
    const [rows] = await pool.execute(
      `SELECT p.id_pedido, p.data_pedido, p.tipo_pedido, p.status_pedido, p.valor_total,
              GROUP_CONCAT(CONCAT(pr.nome_produto, ' (', ip.quantidade, ')') ORDER BY pr.nome_produto SEPARATOR ', ') AS itens
         FROM pedidos p
         LEFT JOIN item_pedido ip ON ip.id_pedido = p.id_pedido
         LEFT JOIN produtos pr ON pr.id_produto = ip.id_produto
        WHERE p.id_cliente = ?
        GROUP BY p.id_pedido
        ORDER BY p.data_pedido DESC`, [id]
    );
    return rows;
  },

  async listarFornecedores(busca = '', status = 'ativos') {
    const termo = `%${busca}%`;
    const ativo = status === 'todos' ? null : status === 'inativos' ? 0 : 1;
    const [rows] = await pool.execute(
      `SELECT f.id_fornecedor, f.nome_fornecedor, f.telefone_fornecedor, f.email_fornecedor,
              f.cnpj_fornecedor, f.rua, f.numero, f.bairro, f.cidade, f.estado, f.cep,
              f.complemento, f.ativo, f.criado_em,
              COALESCE((SELECT SUM(c.valor_total) FROM compras c WHERE c.id_fornecedor = f.id_fornecedor AND c.status_compra <> 'CANCELADA'), 0) AS total_comprado,
              (SELECT GROUP_CONCAT(DISTINCT pr.nome_produto ORDER BY pr.nome_produto SEPARATOR ', ')
                 FROM fornecedor_produto fp JOIN produtos pr ON pr.id_produto = fp.id_produto
                WHERE fp.id_fornecedor = f.id_fornecedor) AS produtos_fornecidos
         FROM fornecedores f
        WHERE (f.nome_fornecedor LIKE ? OR f.telefone_fornecedor LIKE ? OR f.cnpj_fornecedor LIKE ?)
          AND (? IS NULL OR f.ativo = ?)
        ORDER BY f.nome_fornecedor ASC`,
      [termo, termo, termo, ativo, ativo]
    );
    return rows;
  },

  async buscarFornecedorPorId(id: number) {
    const [rows] = await pool.execute('SELECT * FROM fornecedores WHERE id_fornecedor = ? LIMIT 1', [id]);
    return (rows as any[])[0] ?? null;
  },

  async criarFornecedor(input: FornecedorInput) {
    const [result] = await pool.execute(
      `INSERT INTO fornecedores
       (nome_fornecedor, telefone_fornecedor, email_fornecedor, cnpj_fornecedor,
        rua, numero, bairro, cidade, estado, cep, complemento, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [input.nome.trim(), input.telefone ? digits(input.telefone) : null, input.email?.trim() || null,
       input.cnpj?.trim() || null, input.rua?.trim() || null, input.numero?.trim() || null,
       input.bairro?.trim() || null, input.cidade?.trim() || null, input.estado?.trim() || null,
       input.cep?.trim() || null, input.complemento?.trim() || null]
    );
    return (result as any).insertId as number;
  },

  async atualizarFornecedor(id: number, input: FornecedorInput) {
    await pool.execute(
      `UPDATE fornecedores SET nome_fornecedor = ?, telefone_fornecedor = ?, email_fornecedor = ?,
       cnpj_fornecedor = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, complemento = ?
       WHERE id_fornecedor = ?`,
      [input.nome.trim(), input.telefone ? digits(input.telefone) : null, input.email?.trim() || null,
       input.cnpj?.trim() || null, input.rua?.trim() || null, input.numero?.trim() || null,
       input.bairro?.trim() || null, input.cidade?.trim() || null, input.estado?.trim() || null,
       input.cep?.trim() || null, input.complemento?.trim() || null, id]
    );
  },

  async alterarStatusFornecedor(id: number, ativo: boolean) {
    await pool.execute('UPDATE fornecedores SET ativo = ? WHERE id_fornecedor = ?', [ativo, id]);
  },

  async historicoFornecedor(id: number) {
    const [rows] = await pool.execute(
      `SELECT c.id_compra, c.data_compra, c.status_compra, c.valor_total,
              GROUP_CONCAT(CONCAT(pr.nome_produto, ' (', ic.quantidade, ')') ORDER BY pr.nome_produto SEPARATOR ', ') AS itens
         FROM compras c
         LEFT JOIN itens_compra ic ON ic.id_compra = c.id_compra
         LEFT JOIN produtos pr ON pr.id_produto = ic.id_produto
        WHERE c.id_fornecedor = ?
        GROUP BY c.id_compra ORDER BY c.data_compra DESC`, [id]
    );
    return rows;
  }
};