import bcrypt from "bcryptjs";
import type { Usuario } from "./auth.types";
import {
  buscarUsuarioPorEmail,
  salvarUsuario
} from "./auth.repository";

export async function cadastrarUsuario(
  nome: string,
  email: string,
  senha: string
): Promise<Usuario> {
  const nomeNormalizado = nome.trim();
  const emailNormalizado = email.trim().toLowerCase();

  if (!nomeNormalizado) {
    throw new Error("O nome é obrigatório.");
  }

  if (!emailNormalizado || !emailNormalizado.includes("@")) {
    throw new Error("E-mail inválido.");
  }

  if (buscarUsuarioPorEmail(emailNormalizado)) {
    throw new Error("Este e-mail já está cadastrado.");
  }

  if (!senha || !senha.trim()) {
    throw new Error("A senha é obrigatória.");
  }

  if (senha.length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario: Usuario = {
    id: Date.now(),
    nome: nomeNormalizado,
    email: emailNormalizado,
    senhaHash
  };

  salvarUsuario(usuario);

  return usuario;
}
