
import { pool } from "../../database/connection";

async function testarConexao() {
  try {
    const [resultado] = await pool.query("SELECT 1 AS conectado");
    console.log("Conexão com o MySQL funcionando!", resultado);
  } catch (erro) {
    console.error("Erro ao conectar com o MySQL:", erro);
  } finally {
    await pool.end();
  }
}

testarConexao();
