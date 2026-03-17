import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

async function applyMigration() {
  try {
    console.log('🔄 Applying migration to Supabase...');
    
    // Read the migration file
    const migrationPath = '../database/migrations/007_create_raw_sql_rpc.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration file loaded, executing...');
    
    // For now, let's try to create a simple RPC function first
    const simpleRPC = `
      CREATE OR REPLACE FUNCTION execute_raw_sql(sql_query TEXT, params TEXT[] DEFAULT '{}')
      RETURNS TABLE(data JSONB)
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Simple implementation for SELECT queries only
        IF UPPER(TRIM(sql_query)) NOT LIKE 'SELECT%' THEN
          RAISE EXCEPTION 'Only SELECT statements are allowed';
        END IF;
        
        RETURN QUERY EXECUTE format('SELECT jsonb_agg(row_to_json(t.*))::text FROM (%s) t', sql_query) 
        INTO result_json;
        RETURN QUERY SELECT result_json::jsonb;
      END;
      $$;
    `;
    
    console.log('🔧 Creating simple RPC function...');
    
    // Try using the PostgreSQL client directly
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    const client = await pool.connect();
    try {
      await client.query(simpleRPC);
      console.log('✅ RPC function created successfully!');
    } catch (error) {
      console.error('❌ Error creating RPC function:', error.message);
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  }
}

applyMigration();
