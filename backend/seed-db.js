/**
 * Run with: node seed-db.js
 * Loads demo data from `database/seed.sql` into the configured DB.
 *
 * WARNING: `database/seed.sql` truncates many tables (it will wipe data).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer backend/.env (so running from repo root still works)
dotenv.config({ path: path.join(__dirname, ".env"), override: false });
dotenv.config({ override: false });

const seedPath = path.resolve(__dirname, "../database/seed.sql");
if (!fs.existsSync(seedPath)) {
  console.error(`Seed file not found: ${seedPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(seedPath, "utf8");

const pool = await mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "educore_db",
  multipleStatements: true,
});

console.log("Seeding database from database/seed.sql ...");
console.log("WARNING: This will TRUNCATE tables in the target database.");

try {
  const force = process.argv.includes("--force");
  try {
    const [[{ usersCount }]] = await pool.query(`SELECT COUNT(*) AS usersCount FROM users WHERE is_deleted = 0`);
    const [[{ schoolsCount }]] = await pool.query(`SELECT COUNT(*) AS schoolsCount FROM schools WHERE is_deleted = 0`);
    if ((Number(usersCount || 0) > 0 || Number(schoolsCount || 0) > 0) && !force) {
      console.error(
        "Refusing to seed because the DB is not empty. Re-run with `--force` if you're sure."
      );
      process.exit(2);
    }
  } catch {
    // ignore (tables might not exist yet)
  }

  await pool.query(sql);
  console.log("Done seeding.");
  process.exit(0);
} catch (e) {
  console.error("Seed failed:", e?.message || e);
  process.exit(1);
} finally {
  try { await pool.end(); } catch {}
}
