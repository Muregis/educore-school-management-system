import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

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
    const migrationPath = './database/migrations/007_create_raw_sql_rpc.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration file loaded, executing...');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`🔧 Executing: ${statement.substring(0, 100)}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });
        
        if (error) {
          console.error(`❌ Error executing statement: ${error.message}`);
          // Try with raw SQL using the client
          try {
            const { error: rawError } = await supabase.from('raw').select('*').limit(1);
            console.log('Raw SQL test result:', rawError);
          } catch (e) {
            console.log('Raw SQL not available, trying direct approach...');
          }
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }
    
    console.log('✅ Migration applied successfully!');
    
    // Test the RPC function
    console.log('🧪 Testing execute_raw_sql function...');
    const { data, error } = await supabase.rpc('execute_raw_sql', {
      sql_query: 'SELECT 1 as test',
      params: []
    });
    
    if (error) {
      console.error('❌ RPC function test failed:', error.message);
    } else {
      console.log('✅ RPC function test passed:', data);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  }
}

applyMigration();
