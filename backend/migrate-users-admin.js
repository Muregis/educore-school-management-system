import './src/config/env.js';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';

// Use service role key for admin operations
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

async function disableRLSAndMigrate() {
  try {
    console.log('🔓 Temporarily disabling RLS for migration...');
    
    // Disable RLS on users table
    const { error: rlsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE users DISABLE ROW LEVEL SECURITY;'
    });
    
    if (rlsError) {
      console.log('⚠️ Could not disable RLS via RPC, trying direct approach...');
    } else {
      console.log('✅ RLS disabled successfully');
    }
    
    // Now try the migration with service role
    console.log('🔄 Starting users migration with service role...');
    
    const mysqlConnection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '0101',
      database: process.env.DB_NAME || 'educore_db',
    });
    
    const [rows] = await mysqlConnection.execute(`
      SELECT user_id, school_id, full_name, email, password_hash, role, status, 
             student_id, is_deleted, created_at, updated_at
      FROM users 
      WHERE is_deleted = 0
    `);
    
    console.log(`📥 Found ${rows.length} users in MySQL`);
    
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
    
    // Use service role for migration
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(usersForSupabase, { onConflict: 'user_id' });
    
    if (error) {
      console.error('❌ Migration error:', error);
      throw error;
    }
    
    console.log(`✅ Successfully migrated ${usersForSupabase.length} users`);
    
    // Re-enable RLS
    console.log('🔒 Re-enabling RLS...');
    const { error: enableError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE users ENABLE ROW LEVEL SECURITY;'
    });
    
    if (enableError) {
      console.log('⚠️ Could not re-enable RLS - please do this manually in Supabase dashboard');
    } else {
      console.log('✅ RLS re-enabled');
    }
    
    await mysqlConnection.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

disableRLSAndMigrate().then(() => {
  console.log('🎉 Migration complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
