import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  // Não deixe senhas reais gravadas no código-fonte.
  // Configure DB_PASSWORD no arquivo .env.
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "beeflux",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4"
});
