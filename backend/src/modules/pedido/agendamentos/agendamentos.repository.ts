import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
// Corrigido (3 níveis):
import { pool } from '../../../database/connection';
import type { AgendamentoCompleto, FiltroAgendamentos } from './agendamentos.types';
import type { TipoPedido, TipoAtendimento } from '../pedidos.types';

// Correção 3: Inserção de agendamento isolada no repositório de agendamentos
export async function inserirAgendamentoRepo(
  conn: PoolConnection,
  d: {
    id_pedido: number;
    tipo_pedido: TipoPedido;
    tipo_atendimento: TipoAtendimento;
    data_hora_agendada: string;
    endereco_entrega: string | null;
    observacao: string | null;
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO agendamentos (id_pedido, tipo_pedido, tipo_atendimento, data_hora_agendada, endereco_entrega, observacao)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      d.id_pedido,
      d.tipo_pedido,
      d.tipo_atendimento,
      d.data_hora_agendada,
      d.endereco_entrega,
      d.observacao
    ]
  );
}

export async function buscarAgendamentoPorId(conn: PoolConnection, idPedido: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id_pedido, tipo_pedido, tipo_atendimento, data_hora_agendada, endereco_entrega, observacao
     FROM agendamentos WHERE id_pedido = ? FOR UPDATE`,
    [idPedido]
  );
  return rows[0] as AgendamentoCompleto | undefined;
}

// Correção 5: Verificação estrita e exata de conflito de horário (1 atendimento por horário)
export async function verificarConflitoHorario(
  conn: PoolConnection,
  dataHora: string,
  idPedidoIgnorar?: number
): Promise<boolean> {
  let query = `SELECT ag.id_pedido
               FROM agendamentos ag
               JOIN pedidos p ON p.id_pedido = ag.id_pedido
               WHERE ag.data_hora_agendada = ?
                 AND p.status_pedido NOT IN ('CANCELADO', 'CONCLUIDO')`;
  const params: Array<string | number> = [dataHora];

  if (idPedidoIgnorar) {
    query += ` AND ag.id_pedido <> ?`;
    params.push(idPedidoIgnorar);
  }

  const [rows] = await conn.query<RowDataPacket[]>(query, params);
  return rows.length > 0;
}

export async function atualizarAgendamentoRepo(
  conn: PoolConnection,
  idPedido: number,
  dados: {
    data_hora_agendada?: string;
    tipo_atendimento?: TipoAtendimento;
    endereco_entrega?: string | null;
    observacao?: string | null;
  }
): Promise<void> {
  const campos: string[] = [];
  const valores: Array<any> = [];

  if (dados.data_hora_agendada !== undefined) {
    campos.push('data_hora_agendada = ?');
    valores.push(dados.data_hora_agendada);
  }
  if (dados.tipo_atendimento !== undefined) {
    campos.push('tipo_atendimento = ?');
    valores.push(dados.tipo_atendimento);
  }
  if (dados.endereco_entrega !== undefined) {
    campos.push('endereco_entrega = ?');
    valores.push(dados.endereco_entrega);
  }
  if (dados.observacao !== undefined) {
    campos.push('observacao = ?');
    valores.push(dados.observacao);
  }

  if (campos.length === 0) return;

  valores.push(idPedido);
  await conn.execute(`UPDATE agendamentos SET ${campos.join(', ')} WHERE id_pedido = ?`, valores);
}

export async function listarAgendamentosRepo(filtro: FiltroAgendamentos): Promise<AgendamentoCompleto[]> {
  const where: string[] = ["p.status_pedido <> 'CANCELADO'"];
  const params: Array<any> = [];

  if (filtro.de) {
    where.push('ag.data_hora_agendada >= ?');
    params.push(`${filtro.de} 00:00:00`);
  }
  if (filtro.ate) {
    // Inclui o dia final inteiro, inclusive 23:59:59.
    where.push('ag.data_hora_agendada < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(`${filtro.ate} 00:00:00`);
  }
  if (filtro.tipo_atendimento) {
    where.push('ag.tipo_atendimento = ?');
    params.push(filtro.tipo_atendimento);
  }

  const sql = `
    SELECT
      ag.id_pedido, ag.tipo_pedido, ag.tipo_atendimento,
      ag.data_hora_agendada, ag.endereco_entrega, ag.observacao,
      p.status_pedido,
      p.id_cliente,
      c.nome_cliente,
      c.telefone_cliente
    FROM agendamentos ag
    JOIN pedidos p ON p.id_pedido = ag.id_pedido
    LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
    WHERE ${where.join(' AND ')}
    ORDER BY ag.data_hora_agendada ASC
  `;

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as AgendamentoCompleto[];
}
