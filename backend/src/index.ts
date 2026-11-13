import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import express from "express";
import cors from "cors";

import { authRoutes } from "./modules/auth/auth.routes";
import { userConfigRoutes } from "./modules/auth/User_config/userConfig.routes";

// Módulos operacionais do BeeFlux
import estoqueRoutes from "./modules/estoque/estoque.routes";
import pedidosRoutes from "./modules/pedido/pedidos.routes";
import agendamentosRoutes from "./modules/pedido/agendamentos/agendamentos.routes";
import contatosRoutes from "./modules/contatos/contatos.routes";
import custosRoutes from "./modules/Mov_financeiro/custos.routes";
import receitasRoutes from "./modules/receitas/receitas.routes";
import cardapioRoutes from "./modules/cardapio/cardapio.routes";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Middlewares essenciais (antes das rotas)
app.use(cors());
app.use(express.json());

// Rota de diagnóstico de integridade da API
app.get("/", (_req, res) => {
  res.json({ mensagem: "API do BeeFlux funcionando com sucesso!" });
});

// Autenticação (cadastro e login) e configuração de usuário
app.use("/api/auth", authRoutes);
app.use("/api/usuarios/config", userConfigRoutes);

// Módulos operacionais
app.use("/api/estoque", estoqueRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/agendamentos", agendamentosRoutes);
app.use("/api/financeiro", custosRoutes);
app.use("/api/receitas", receitasRoutes);
app.use("/api/cardapio", cardapioRoutes);

// Clientes e fornecedores: /api/clientes, /api/fornecedores (e /api/contatos/...)
app.use("/api/contatos", contatosRoutes);
app.use("/api", contatosRoutes);

app.listen(PORT, () => {
  console.log(`BeeFlux API rodando em http://localhost:${PORT}`);
});
