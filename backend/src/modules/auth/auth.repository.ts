import { pool } from "../../database/connection";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { Usuario } from "./auth.types";

interface UsuarioRow extends RowDataPacket {
  id: number;
  nome: string;
  email: string;
  senhaHash: string;
}

export async function buscarUsuarioPorEmail(
  email: string
): Promise<Usuario | undefined> {
  const [rows] = await pool.execute<UsuarioRow[]>(
    `SELECT
       id_user AS id,
       nome_user AS nome,
       email_user AS email,
       senha_user AS senhaHash
     FROM usuarios
     WHERE email_user = ? AND ativo = TRUE
     LIMIT 1`,
    [email]
  );

  return rows[0];
}

export async function salvarUsuario(
  usuario: Omit<Usuario, "id">
): Promise<Usuario> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    `INSERT INTO usuarios (nome_user, email_user, senha_user)
     VALUES (?, ?, ?)`,
    [usuario.nome, usuario.email, usuario.senhaHash]
  );

  return {
    id: resultado.insertId,
    ...usuario,
  };
}
