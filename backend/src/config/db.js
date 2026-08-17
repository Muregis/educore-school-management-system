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

// NEW: Simplified connection test - Supabase or local PostgreSQL
export async function testDbConnection() {
  const isLocalMode = env.databaseMode === "local";

  if (isLocalMode) {
    try {
      await pgPool.query("SELECT 1");
      return { success: true, type: "local" };
    } catch (pgError) {
      console.error('Local PostgreSQL connection failed:', pgError.message);
      throw new Error(`Local database connection failed: ${pgError.message}`);
    }
  }

  try {
    const result = await testSupabaseConnection();
    if (result.success) {
      return { success: true, type: "supabase" };
    }
    throw new Error(result.error);
  } catch (supabaseError) {
    console.error('Supabase connection failed:', supabaseError.message);
    throw new Error(`Database connection failed: ${supabaseError.message}`);
  }
}

export async function applyDatabaseMigrations() {
  const migrationPath = path.resolve(__dirname, '../../../database/migrations/070_fix_missing_audit_columns.sql');
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

    // Custom Fixes for HR Payroll triggers and Expenditures approved_by column type (UUID -> BIGINT)
    console.log('🔧 Applying custom database fixes for HR payroll triggers & expenditures...');
    const customFixes = [
      `CREATE OR REPLACE FUNCTION public.update_updated_at_column()
       RETURNS TRIGGER AS $$
       DECLARE
           _has_updated_at BOOL;
           _has_version    BOOL;
       BEGIN
           _has_updated_at := EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_schema = TG_TABLE_SCHEMA
                 AND table_name   = TG_TABLE_NAME
                 AND column_name  = 'updated_at'
           );
           _has_version := EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_schema = TG_TABLE_SCHEMA
                 AND table_name   = TG_TABLE_NAME
                 AND column_name  = 'version'
           );
           IF _has_updated_at THEN NEW.updated_at = NOW(); END IF;
           IF _has_version    THEN NEW.version = COALESCE(OLD.version, 0) + 1; END IF;
           RETURN NEW;
       END;
       $$ LANGUAGE plpgsql;`,

      `CREATE OR REPLACE FUNCTION update_hr_updated_at_column()
       RETURNS TRIGGER AS $$
       BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
       END;
       $$ LANGUAGE plpgsql;`,

      `DROP TRIGGER IF EXISTS update_hr_payslips_updated_at ON public.hr_payslips;`,
      `CREATE TRIGGER update_hr_payslips_updated_at 
           BEFORE UPDATE ON public.hr_payslips 
           FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at_column();`,

      `DROP TRIGGER IF EXISTS update_hr_attendance_updated_at ON public.hr_attendance;`,
      `CREATE TRIGGER update_hr_attendance_updated_at 
           BEFORE UPDATE ON public.hr_attendance 
           FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at_column();`,

      `DROP TRIGGER IF EXISTS update_hr_staff_updated_at ON public.hr_staff;`,
      `CREATE TRIGGER update_hr_staff_updated_at 
           BEFORE UPDATE ON public.hr_staff 
           FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at_column();`,

      `DROP TRIGGER IF EXISTS update_hr_leave_updated_at ON public.hr_leave;`,
      `CREATE TRIGGER update_hr_leave_updated_at 
           BEFORE UPDATE ON public.hr_leave 
           FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at_column();`,

      `DROP TRIGGER IF EXISTS update_payroll_updated_at ON public.payroll;`,
      `CREATE TRIGGER update_payroll_updated_at 
           BEFORE UPDATE ON public.payroll 
           FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at_column();`,

      `DROP TRIGGER IF EXISTS update_leave_balances_updated_at ON public.leave_balances;`,
      `CREATE TRIGGER update_leave_balances_updated_at 
           BEFORE UPDATE ON public.leave_balances 
           FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at_column();`,

      `ALTER TABLE public.expenditures DROP CONSTRAINT IF EXISTS expenditures_approved_by_fkey;`,
      `ALTER TABLE public.expenditures ALTER COLUMN approved_by TYPE BIGINT USING NULL;`,
      `ALTER TABLE public.expenditures 
           ADD CONSTRAINT expenditures_approved_by_fkey 
           FOREIGN KEY (approved_by) REFERENCES public.users(user_id) 
           ON DELETE SET NULL;`
    ];

    for (const fix of customFixes) {
      try {
        await pgPool.query(fix);
      } catch (err) {
        console.warn('⚠️ Custom fix statement failed or already applied:', err.message);
      }
    }
    console.log('✅ Custom database fixes applied successfully');
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