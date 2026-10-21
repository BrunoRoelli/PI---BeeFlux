
import type { Usuario } from "./auth.types";
import {
  buscarUsuarioPorEmail,
  salvarUsuario
} from "./auth.repository";

export function cadastrarUsuario(
  nome: string,
  email: string,
  senhaHash: string
): Usuario {
  if (!nome.trim()) {
    throw new Error("O nome é obrigatório.");
  }

  if (!email.trim() || !email.includes("@")) {
    throw new Error("E-mail inválido.");
  }

  if (buscarUsuarioPorEmail(email)) {
    throw new Error("Este e-mail já está cadastrado.");
  }

  if (!senhaHash) {
    throw new Error("A senha é obrigatória.");
  }

  const usuario: Usuario = {
    id: Date.now(),
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    senhaHash
  };

  salvarUsuario(usuario);

  return usuario;
}
