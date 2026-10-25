import bcrypt from "bcryptjs";
import {
  buscarUsuarioPorId,
  atualizarNomeUsuario,
  atualizarSenhaUsuario,
} from "./userConfig.repository";

export async function alterarNomeUsuario(idUsuario: number, novoNome: string): Promise<string> {
  const nomeLimpo = novoNome.trim();

  if (!nomeLimpo) {
    throw new Error("O nome não pode estar em branco.");
  }

  if (nomeLimpo.length > 100) {
    throw new Error("O nome deve ter no máximo 100 caracteres.");
  }

  const usuario = await buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw new Error("Usuário não encontrado.");
  }

  await atualizarNomeUsuario(idUsuario, nomeLimpo);
  return nomeLimpo;
}

export async function alterarSenhaUsuario(
  idUsuario: number,
  senhaAtual: string,
  novaSenha: string
): Promise<void> {
  if (!senhaAtual) {
    throw new Error("Informe a senha atual.");
  }

  if (!novaSenha || !novaSenha.trim()) {
    throw new Error("A nova senha é obrigatória.");
  }

  if (novaSenha.length < 8) {
    throw new Error("A nova senha deve ter pelo menos 8 caracteres.");
  }

  if (!/[A-Z]/.test(novaSenha)) {
    throw new Error("A nova senha deve conter pelo menos uma letra maiúscula.");
  }

  if (!/[^A-Za-z0-9]/.test(novaSenha)) {
    throw new Error("A nova senha deve conter pelo menos um símbolo especial.");
  }

  const usuario = await buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw new Error("Usuário não encontrado.");
  }

  const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!senhaCorreta) {
    throw new Error("Senha atual incorreta.");
  }

  const mesmaSenha = await bcrypt.compare(novaSenha, usuario.senhaHash);
  if (mesmaSenha) {
    throw new Error("A nova senha não pode ser igual à senha atual.");
  }

  const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
  await atualizarSenhaUsuario(idUsuario, novaSenhaHash);
}