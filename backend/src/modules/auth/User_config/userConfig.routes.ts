import { Router } from "express";
import {
  alterarNomeUsuario,
  alterarSenhaUsuario,
} from "./userConfig.service";

export const userConfigRoutes = Router();

// PATCH /api/usuarios/config/:id/nome
userConfigRoutes.patch("/:id/nome", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome } = req.body ?? {};

    if (isNaN(id) || typeof nome !== "string") {
      res.status(400).json({ mensagem: "ID ou nome inválidos." });
      return;
    }

    const nomeAtualizado = await alterarNomeUsuario(id, nome);
    res.status(200).json({
      mensagem: "Nome alterado com sucesso!",
      nome: nomeAtualizado,
    });
  } catch (erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : "Erro ao alterar nome.";
    const status = mensagem === "Usuário não encontrado." ? 404 : 400;
    res.status(status).json({ mensagem });
  }
});

// PATCH /api/usuarios/config/:id/senha
userConfigRoutes.patch("/:id/senha", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { senhaAtual, novaSenha } = req.body ?? {};

    if (
      isNaN(id) ||
      typeof senhaAtual !== "string" ||
      typeof novaSenha !== "string"
    ) {
      res.status(400).json({
        mensagem: "Informe o ID, a senha atual e a nova senha corretamente.",
      });
      return;
    }

    await alterarSenhaUsuario(id, senhaAtual, novaSenha);
    res.status(200).json({ mensagem: "Senha alterada com sucesso!" });
  } catch (erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : "Erro ao alterar senha.";
    const status =
      mensagem === "Senha atual incorreta."
        ? 401
        : mensagem === "Usuário não encontrado."
        ? 404
        : 400;
    res.status(status).json({ mensagem });
  }
});