import "dotenv/config";
import express from "express";
import cors from "cors";

import { exigirSegredoJwt } from "./modules/auth/auth.token";
import { authRoutes } from "./modules/auth/auth.routes";
import { userConfigRoutes } from "./modules/auth/User_config/userConfig.routes";
import { autenticar, usarIdDoUsuarioLogado } from "./middlewares/autenticar";

// Módulos operacionais do BeeFlux
import estoqueRoutes from "./modules/estoque/estoque.routes";
import pedidosRoutes from "./modules/pedido/pedidos.routes";
import agendamentosRoutes from "./modules/pedido/agendamentos/agendamentos.routes";
import contatosRoutes from "./modules/contatos/contatos.routes";
import custosRoutes from "./modules/Mov_financeiro/custos.routes";
import receitasRoutes from "./modules/receitas/receitas.routes";
import cardapioRoutes from "./modules/cardapio/cardapio.routes";

// Falha logo na inicialização se o JWT_SECRET não estiver no .env.
exigirSegredoJwt();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Origens do frontend liberadas (separadas por vírgula no .env).
const origensPermitidas = (
  process.env.CORS_ORIGINS ??
  "http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000"
)
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

// Middlewares essenciais (antes das rotas)
app.use(cors({ origin: origensPermitidas }));
app.use(express.json());

// Rota de diagnóstico de integridade da API
app.get("/", (_req, res) => {
  res.json({ mensagem: "API do BeeFlux funcionando com sucesso!" });
});

// ===== Rotas públicas =====
app.use("/api/auth", authRoutes); // cadastro e login

// ===== Rotas protegidas (exigem token) =====
app.use("/api/usuarios/config", autenticar, userConfigRoutes);

// Cardápio: /publico fica aberto (clientes); /admin exige token.
app.use("/api/cardapio/admin", autenticar);
app.use("/api/cardapio", cardapioRoutes);

app.use("/api/estoque", autenticar, estoqueRoutes);
app.use("/api/pedidos", autenticar, usarIdDoUsuarioLogado, pedidosRoutes);
app.use("/api/agendamentos", autenticar, usarIdDoUsuarioLogado, agendamentosRoutes);
app.use("/api/financeiro", autenticar, custosRoutes);
app.use("/api/receitas", autenticar, receitasRoutes);

// Clientes e fornecedores: /api/clientes, /api/fornecedores (e /api/contatos/...)
app.use("/api/contatos", autenticar, contatosRoutes);
app.use("/api", autenticar, contatosRoutes);

app.listen(PORT, () => {
  console.log(`BeeFlux API rodando em http://localhost:${PORT}`);
});
