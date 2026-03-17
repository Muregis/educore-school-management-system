import './src/config/env.js';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';

// Create admin client with service role key (bypasses RLS)
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

async function bypassRLSAndMigrate() {
  try {
    console.log('🔓 Attempting RLS bypass with service role...');
    
    // Test service role access
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Service role blocked:', error.message);
      console.log('💡 The SUPABASE_SERVICE_ROLE_KEY in .env may not be the correct service role key');
      console.log('💡 Service role keys usually start with "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6..."');
      return false;
    }
    
    console.log('✅ Service role access confirmed');
    
    // Get MySQL users
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
      ORDER BY user_id
    `);
    
    console.log(`📥 Migrating ${rows.length} users to Supabase...`);
    
    // Transform and insert
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
    
    // Insert all users at once
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('users')
      .upsert(usersForSupabase, { onConflict: 'user_id' })
      .select();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      return false;
    }
    
    console.log(`✅ Successfully migrated ${insertedData?.length || usersForSupabase.length} users`);
    
    // Verify
    const { count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total users in Supabase: ${count}`);
    
    // Test admin user
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('email, role')
      .eq('email', 'admin@greenfield.ac.ke')
      .single();
    
    if (adminUser) {
      console.log('✅ Admin user verified:', adminUser);
    }
    
    await mysqlConnection.end();
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

bypassRLSAndMigrate().then(success => {
  if (success) {
    console.log('🎉 Migration complete! Supabase now has all users.');
    console.log('🔄 The hybrid auth system will now prefer Supabase over MySQL.');
  } else {
    console.log('⚠️ Migration failed. Check SUPABASE_SERVICE_ROLE_KEY in .env');
  }
  process.exit(0);
});
