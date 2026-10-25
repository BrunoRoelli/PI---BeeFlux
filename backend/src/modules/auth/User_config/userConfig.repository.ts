import { pool } from "../../../database/connection";
import type { RowDataPacket } from "mysql2";
import type { Usuario } from "../auth.types";

interface UsuarioRow extends RowDataPacket {
  id: number;
  nome: string;
  email: string;
  senhaHash: string;
}

export async function buscarUsuarioPorId(id: number): Promise<Usuario | undefined> {
  const [rows] = await pool.execute<UsuarioRow[]>(
    `SELECT
       id_user AS id,
       nome_user AS nome,
       email_user AS email,
       senha_user AS senhaHash
     FROM usuarios
     WHERE id_user = ? AND ativo = TRUE
     LIMIT 1`,
    [id]
  );

  return rows[0];
}

export async function atualizarNomeUsuario(id: number, novoNome: string): Promise<void> {
  await pool.execute(
    `UPDATE usuarios
     SET nome_user = ?
     WHERE id_user = ? AND ativo = TRUE`,
    [novoNome, id]
  );
}

export async function atualizarSenhaUsuario(id: number, novaSenhaHash: string): Promise<void> {
  await pool.execute(
    `UPDATE usuarios
     SET senha_user = ?
     WHERE id_user = ? AND ativo = TRUE`,
    [novaSenhaHash, id]
  );
}