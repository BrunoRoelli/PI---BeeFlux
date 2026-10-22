import express from "express";

const app = express();
const PORT = 3000;

// Permite receber requisições com corpo JSON
app.use(express.json());

// Rota inicial para verificar se a API está funcionando
app.get("/", (_req, res) => {
  res.json({
    mensagem: "API do BeeFlux funcionando!"
  });
});

app.listen(PORT, () => {
  console.log(`BeeFlux API rodando em http://localhost:${PORT}`);
});
