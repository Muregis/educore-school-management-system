import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { pgPool } from './backend/src/config/pg.js';

async function applyMigration() {
  const sqlPath = path.join(process.cwd(), 'database', 'migrations', 'phase6a_enterprise_security.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pgPool.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pgPool.end();
  }
}
applyMigration();
