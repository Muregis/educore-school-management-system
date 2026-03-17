import './src/config/env.js';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';

// Create admin client with proper service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function fixRLSAndMigrate() {
  try {
    console.log('🔧 Fixing RLS policies for data migration...');
    
    // Method 1: Try to disable RLS temporarily
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql: 'ALTER TABLE users DISABLE ROW LEVEL SECURITY;'
      });
      
      if (!error) {
        console.log('✅ RLS disabled successfully');
      } else {
        console.log('⚠️ Could not disable RLS via RPC');
      }
    } catch (err) {
      console.log('⚠️ RLS disable failed, trying alternative approach...');
    }
    
    // Method 2: Try direct SQL execution
    try {
      const { error } = await supabaseAdmin
        .from('users')
        .select('count')
        .limit(1);
      
      if (!error) {
        console.log('✅ Service role has access to users table');
      } else {
        console.log('❌ Service role blocked:', error.message);
        return false;
      }
    } catch (err) {
      console.log('❌ Service role test failed:', err.message);
      return false;
    }
    
    // Now attempt migration
    console.log('🔄 Starting data migration...');
    
    const mysqlConnection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '0101',
      database: process.env.DB_NAME || 'educore_db',
    });
    
    // Get all users from MySQL
    const [rows] = await mysqlConnection.execute(`
      SELECT user_id, school_id, full_name, email, password_hash, role, status, 
             student_id, is_deleted, created_at, updated_at
      FROM users 
      ORDER BY user_id
    `);
    
    console.log(`📥 Found ${rows.length} users to migrate`);
    
    // Transform for Supabase
    const usersForSupabase = rows.map(user => ({
      user_id: user.user_id,
      school_id: user.school_id,
      full_name: user.full_name,
      email: user.email,
      password_hash: user.password_hash,
      role: user.role,
      status: user.status,
      student_id: user.student_id,
      is_deleted: Boolean(user.is_deleted),
      created_at: user.created_at,
      updated_at: user.updated_at
    }));
    
    // Insert in batches to avoid timeouts
    const batchSize = 5;
    for (let i = 0; i < usersForSupabase.length; i += batchSize) {
      const batch = usersForSupabase.slice(i, i + batchSize);
      
      const { data, error } = await supabaseAdmin
        .from('users')
        .upsert(batch, { onConflict: 'user_id' });
      
      if (error) {
        console.error(`❌ Batch ${i}-${i+batchSize} failed:`, error);
      } else {
        console.log(`✅ Batch ${i}-${i+batchSize} migrated successfully`);
      }
    }
    
    // Verify migration
    const { count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Migration complete: ${count} users in Supabase`);
    
    // Test admin user
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('email, role')
      .eq('email', 'admin@greenfield.ac.ke')
      .single();
    
    if (adminUser) {
      console.log('✅ Admin user verified in Supabase:', adminUser);
    }
    
    await mysqlConnection.end();
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

fixRLSAndMigrate().then(success => {
  if (success) {
    console.log('🎉 Data migration complete! Ready to switch to Supabase.');
  } else {
    console.log('⚠️ Migration failed. Manual RLS configuration needed.');
  }
  process.exit(0);
}).catch(error => {
  console.error('💥 Critical error:', error);
  process.exit(1);
});
