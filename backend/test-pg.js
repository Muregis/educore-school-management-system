/**
 * Run with: node test-pg.js
 * Validates Postgres connectivity without affecting the MySQL-based app.
 */
import "./src/config/env.js";
import { pgPool, testPgConnection } from "./src/config/pg.js";

async function main() {
  try {
    await testPgConnection();
    const { rows } = await pgPool.query(
      "SELECT current_database() AS db, current_user AS user"
    );
    console.log("Postgres connected:", rows[0]);
    process.exit(0);
  } catch (err) {
    console.error("Postgres connection failed:", err?.message || err);
    process.exit(1);
  } finally {
    try {
      await pgPool.end();
    } catch {
      // ignore
    }
  }
}

main();

