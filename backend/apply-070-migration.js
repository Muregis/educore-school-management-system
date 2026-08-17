import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL in environment variables');
  console.error('   Set either DATABASE_URL (direct postgres:// connection string) or');
  console.error('   SUPABASE_DB_URL in the backend/.env file or shell environment before running.');
  process.exit(1);
}

const migrationFile = process.env.MIGRATION_FILE ||
  path.resolve(__dirname, '../database/migrations/070_fix_missing_audit_columns.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Migration file not found: ${migrationFile}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf8').trim();

async function applyMigration() {
  const pgModule = await import('pg');
  const Pool = pgModule.Pool || pgModule.default?.Pool;
  if (!Pool) {
    console.error('❌ Could not load pg.Pool constructor. Module exports:', Object.keys(pgModule));
    process.exit(1);
  }
  const pool = new Pool({ connectionString: dbUrl, ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false } });

  const client = await pool.connect();
  try {
    console.log(`🔄 Applying migration to database via DATABASE_URL...`);
    console.log(`   File: ${migrationFile}`);

    await client.query('BEGIN');
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Migration applied successfully (committed).');
    } catch (execErr) {
      await client.query('ROLLBACK');
      console.error('❌ Migration execution failed (rolled back):', execErr.message);
      console.error('   Detail:', execErr.detail || '');
      console.error('   Hint:', execErr.hint || '');
      console.error('   Position:', execErr.position || '');
      process.exitCode = 1;
    }
  } catch (connErr) {
    console.error('❌ Database connection failed:', connErr.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
