
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "4728189@Fatec",
  database: process.env.DB_NAME || "beeflux",
  waitForConnections: true,
  connectionLimit: 10,
});
