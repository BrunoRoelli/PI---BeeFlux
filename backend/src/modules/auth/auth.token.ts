import { createHmac, timingSafeEqual } from "node:crypto";

// Token JWT (HS256) assinado com o segredo JWT_SECRET do arquivo .env.
// Implementado com o módulo nativo "node:crypto" para não exigir dependência extra.
// Se o grupo preferir, é possível trocar por "jsonwebtoken" mantendo estas duas funções.

export interface PayloadToken {
  sub: number; // id do usuário
  nome: string;
  iat: number; // emitido em (segundos)
  exp: number; // expira em (segundos)
}

const HORAS_PADRAO = 8;

export function exigirSegredoJwt(): string {
  const segredo = process.env.JWT_SECRET;

  if (!segredo || segredo.length < 16) {
    throw new Error(
      "JWT_SECRET não configurado. Defina no arquivo .env um segredo com pelo menos 16 caracteres."
    );
  }

  return segredo;
}

function emBase64Url(valor: string | Buffer): string {
  return Buffer.from(valor).toString("base64url");
}

function assinar(conteudo: string, segredo: string): string {
  return createHmac("sha256", segredo).update(conteudo).digest("base64url");
}

export function gerarToken(usuario: { id: number; nome: string }): string {
  const segredo = exigirSegredoJwt();
  const horas = Number(process.env.JWT_EXPIRES_IN_HOURS ?? HORAS_PADRAO);
  const agora = Math.floor(Date.now() / 1000);

  const cabecalho = emBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: PayloadToken = {
    sub: usuario.id,
    nome: usuario.nome,
    iat: agora,
    exp: agora + Math.round((Number.isFinite(horas) && horas > 0 ? horas : HORAS_PADRAO) * 3600),
  };
  const corpo = emBase64Url(JSON.stringify(payload));
  const assinatura = assinar(`${cabecalho}.${corpo}`, segredo);

  return `${cabecalho}.${corpo}.${assinatura}`;
}

// Retorna o payload se o token for válido e não estiver expirado; caso contrário, null.
export function verificarToken(token: string): PayloadToken | null {
  const segredo = exigirSegredoJwt();
  const partes = token.split(".");

  if (partes.length !== 3) return null;

  const [cabecalho, corpo, assinatura] = partes as [string, string, string];

  try {
    const cabecalhoJson = JSON.parse(Buffer.from(cabecalho, "base64url").toString("utf8"));
    if (cabecalhoJson?.alg !== "HS256") return null;

    const esperada = Buffer.from(assinar(`${cabecalho}.${corpo}`, segredo));
    const recebida = Buffer.from(assinatura);

    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as PayloadToken;

    if (!Number.isSafeInteger(payload.sub) || payload.sub <= 0) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
