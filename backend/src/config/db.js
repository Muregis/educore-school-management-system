import { supabase, database, testSupabaseConnection } from "./supabaseClient.js";
import { env } from "./env.js";

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