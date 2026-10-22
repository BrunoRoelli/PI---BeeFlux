import express from "express";
import { cadastrarUsuario, autenticarUsuario } from "./modules/auth/auth.service";
import cors from "cors";

const app = express();
const PORT = 3000;
app.use(cors());

// Permite receber requisições com corpo JSON
app.use(express.json());

// Rota inicial para verificar se a API está funcionando
app.get("/", (_req, res) => {
  res.json({
    mensagem: "API do BeeFlux funcionando!"
  });
});


app.post("/api/auth/cadastro", async (req, res) => {
  try {
    const { nome, email, senha } = req.body ?? {};

    if (
      typeof nome !== "string" ||
      typeof email !== "string" ||
      typeof senha !== "string"
    ) {
      res.status(400).json({
        mensagem: "Informe nome, e-mail e senha válidos."
      });
      return;
    }

    const usuario = await cadastrarUsuario(nome, email, senha);

    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso!",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (erro: unknown) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Erro interno ao cadastrar usuário.";

    const errosDeValidacao = [
      "O nome é obrigatório.",
      "E-mail inválido.",
      "A senha é obrigatória.",
      "A senha deve ter pelo menos 6 caracteres.",
      "Este e-mail já está cadastrado."
    ];

    const status = errosDeValidacao.includes(mensagem) ? 400 : 500;

    res.status(status).json({ mensagem });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, senha } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof senha !== "string" ||
      !email.trim() ||
      !senha
    ) {
      res.status(400).json({
        mensagem: "Informe o e-mail e a senha.",
      });
      return;
    }

    const usuario = await autenticarUsuario(email, senha);

    res.status(200).json({
      mensagem: "Login realizado com sucesso!",
      usuario,
    });
  } catch (erro: unknown) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Erro interno ao realizar login.";

    const status =
      mensagem === "E-mail ou senha incorretos." ? 401 : 500;

    res.status(status).json({ mensagem });
  }
});

app.listen(PORT, () => {
  console.log(`BeeFlux API rodando em http://localhost:${PORT}`);
});
