import express from "express";
import cors from "cors";
import { cadastrarUsuario, autenticarUsuario } from "./modules/auth/auth.service";
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

// Middlewares essenciais
app.use(cors());
app.use(express.json());

// Rota de diagnóstico de integridade da API
app.get("/", (_req, res) => {
  res.json({ mensagem: "API do BeeFlux funcionando com sucesso!" });
});

// Autenticação
app.post("/api/auth/cadastro", async (req, res) => {
  try {
    const { nome, email, senha } = req.body ?? {};
    if (typeof nome !== "string" || typeof email !== "string" || typeof senha !== "string") {
      res.status(400).json({ mensagem: "Informe nome, e-mail e senha válidos." });
      return;
    }
    const usuario = await cadastrarUsuario(nome, email, senha);
    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso!",
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : "Erro interno ao cadastrar usuário.";
    res.status(400).json({ mensagem });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, senha } = req.body ?? {};
    if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha) {
      res.status(400).json({ mensagem: "Informe o e-mail e a senha." });
      return;
    }
    const usuario = await autenticarUsuario(email, senha);
    res.status(200).json({ mensagem: "Login realizado com sucesso!", usuario });
  } catch (erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : "Erro interno ao realizar login.";
    res.status(mensagem === "E-mail ou senha incorretos." ? 401 : 500).json({ mensagem });
  }
});

// Rotas de configuração de usuário
app.use("/api/usuarios/config", userConfigRoutes);

// Rotas integradas de Estoque e Pedidos
app.use("/api/estoque", estoqueRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/agendamentos", agendamentosRoutes);

// Suporte para chamadas de clientes e fornecedores
app.use("/api", contatosRoutes);
app.use("/api/contatos", contatosRoutes);

// Demais módulos
app.use("/api/financeiro", custosRoutes);
app.use("/api/receitas", receitasRoutes);
app.use("/api/cardapio", cardapioRoutes);

app.listen(PORT, () => {
  console.log(`BeeFlux API rodando em http://localhost:${PORT}`);
});