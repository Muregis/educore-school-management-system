import { pgPool } from "./pg.js";
import { env } from "./env.js";

// Default to PostgreSQL, fallback to MySQL for legacy compatibility
export const pool = pgPool;

// MySQL pool for legacy compatibility (kept as backup)
import mysql from "mysql2/promise";
export const mysqlPool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function testDbConnection() {
  try {
    await pgPool.query("SELECT 1");
    return { success: true, type: 'postgresql' };
  } catch (pgError) {
    console.warn('PostgreSQL connection failed, trying MySQL:', pgError.message);
    try {
      const conn = await mysqlPool.getConnection();
      await conn.query("SELECT 1");
      conn.release();
      return { success: true, type: 'mysql' };
    } catch (mysqlError) {
      throw new Error(`Both PostgreSQL and MySQL failed: PG: ${pgError.message}, MySQL: ${mysqlError.message}`);
    }
  }
}