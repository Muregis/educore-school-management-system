import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, database, testSupabaseConnection } from "./supabaseClient.js";
import { pgPool } from "./pg.js";
import { env } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PRIMARY DATABASE: Unified Supabase interface
export const pool = database;
export const db = database;
export { database }; // Add this export

// OLD: Legacy Supabase client (commented for safety)
// import { supabase } from "./supabase.js";
// export const pool = supabase;

// OLD: PostgreSQL pool for raw SQL queries (commented for safety)
// import { pgPool } from "./pg.js";
// export { pgPool };

// OLD: MySQL pool for legacy compatibility (commented for safety)
// import mysql from "mysql2/promise";
// export const mysqlPool = mysql.createPool({
//   host: env.dbHost,
//   port: env.dbPort,
//   user: env.dbUser,
//   password: env.dbPassword,
//   database: env.dbName,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// NEW: Simplified connection test - Supabase only
export async function testDbConnection() {
  try {
    const result = await testSupabaseConnection();
    if (result.success) {
      return { success: true, type: 'supabase' };
    }
    throw new Error(result.error);
  } catch (supabaseError) {
    console.error('Supabase connection failed:', supabaseError.message);
    throw new Error(`Database connection failed: ${supabaseError.message}`);
  }
}

export async function applyDatabaseMigrations() {
  const migrationPath = path.resolve(__dirname, '../../../database/migrations/011_add_mpesa_reconciliation.sql');
  if (!fs.existsSync(migrationPath)) {
    console.warn(`⚠️ Migration file not found: ${migrationPath}`);
    return;
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf8').trim();
  if (!migrationSql) {
    console.warn(`⚠️ Migration file is empty: ${migrationPath}`);
    return;
  }

  try {
    console.log(`🔧 Applying database migrations from ${migrationPath}`);
    // Try to execute SQL via pgPool (raw PostgreSQL connection)
    const statements = migrationSql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await pgPool.query(statement);
      } catch (err) {
        if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
          // Table already exists, that's fine
          console.log(`✓ Migration statement already completed (${statement.substring(0, 50)}...)`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('✅ Database migrations applied successfully');
  } catch (err) {
    console.error('❌ Failed to apply database migrations:', err.message);
    // Don't throw - migrations are important but not critical for startup
    // The app can still run, routes just won't work until tables are created
  }
}

// OLD: Multi-database fallback system (commented for safety)
// export async function testDbConnection() {
//   try {
//     const result = await testSupabaseConnection();
//     if (result.success) {
//       return { success: true, type: 'supabase' };
//     }
//     throw new Error(result.error);
//   } catch (supabaseError) {
//     console.warn('Supabase connection failed, trying PostgreSQL:', supabaseError.message);
//     try {
//       await pgPool.query("SELECT 1");
//       return { success: true, type: 'postgresql' };
//     } catch (pgError) {
//       console.warn('PostgreSQL connection failed, trying MySQL:', pgError.message);
//       try {
//         const conn = await mysqlPool.getConnection();
//         await conn.query("SELECT 1");
//         conn.release();
//         return { success: true, type: 'mysql' };
//       } catch (mysqlError) {
//         throw new Error(`All connections failed: Supabase: ${supabaseError.message}, PG: ${pgError.message}, MySQL: ${mysqlError.message}`);
//       }
//     }
//   }
// }

// Export the raw Supabase client for advanced operations
export { supabase };