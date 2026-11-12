import type { NextFunction, Request, Response } from "express";
import { verificarToken } from "../modules/auth/auth.token";

// Exige "Authorization: Bearer <token>" e guarda o id do usuário logado em res.locals.idUsuario.
export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const [esquema, token] = (req.headers.authorization ?? "").split(" ");

  if (esquema !== "Bearer" || !token) {
    res.status(401).json({ mensagem: "Autenticação necessária." });
    return;
  }

  const payload = verificarToken(token);

  if (!payload) {
    res.status(401).json({ mensagem: "Sessão inválida ou expirada. Faça login novamente." });
    return;
  }

  res.locals.idUsuario = payload.sub;
  next();
}

// Para os módulos que recebem "id_user" no corpo (pedidos e agendamentos):
// ignora o valor enviado pelo navegador e usa sempre o id do token.
export function usarIdDoUsuarioLogado(req: Request, res: Response, next: NextFunction): void {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const corpo = req.body;

    if (corpo === undefined || corpo === null) {
      req.body = { id_user: res.locals.idUsuario };
    } else if (typeof corpo === "object" && !Array.isArray(corpo)) {
      corpo.id_user = res.locals.idUsuario;
    }
  }

  next();
}
