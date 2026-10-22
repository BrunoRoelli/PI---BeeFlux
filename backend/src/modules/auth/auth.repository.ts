import type { Usuario } from "./auth.types";

const usuarios: Usuario[] = [];

export function listarUsuarios(): Usuario[] {
  return usuarios;
}

export function buscarUsuarioPorEmail(
  email: string
): Usuario | undefined {
  return usuarios.find(
    (usuario) => usuario.email === email
  );
}

export function salvarUsuario(usuario: Usuario): void {
  usuarios.push(usuario);
}