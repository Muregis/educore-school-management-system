import './src/config/env.js';
import mysql from 'mysql2/promise';
import { supabase } from './src/config/supabase.js';

// Create MySQL connection
const mysqlConnection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '0101',
  database: process.env.DB_NAME || 'educore_db',
});

async function migrateUsers() {
  try {
    console.log('🔄 Starting users migration from MySQL to Supabase...');
    
    // 1. Export users from MySQL
    const [rows] = await mysqlConnection.execute(`
      SELECT user_id, school_id, full_name, email, password_hash, role, status, 
             student_id, is_deleted, created_at, updated_at
      FROM users 
      WHERE is_deleted = 0
    `);
    
    console.log(`📥 Found ${rows.length} users in MySQL`);
    
    if (rows.length === 0) {
      console.log('❌ No users found in MySQL to migrate');
      return;
    }
    
    // 2. Transform data for PostgreSQL/Supabase
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
    
    console.log('🔄 Data transformation complete');
    
    // 3. Import into Supabase
    const { data, error } = await supabase
      .from('users')
      .upsert(usersForSupabase, { onConflict: 'user_id' });
    
    if (error) {
      console.error('❌ Supabase insert error:', error);
      throw error;
    }
    
    console.log(`✅ Successfully migrated ${usersForSupabase.length} users to Supabase`);
    
    // 4. Verify migration
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Verification: ${count} users now in Supabase`);
    
    // 5. Test a sample user
    const { data: sampleUser } = await supabase
      .from('users')
      .select('email, role')
      .eq('email', 'admin@greenfield.ac.ke')
      .single();
    
    if (sampleUser) {
      console.log('✅ Sample user verification:', sampleUser);
    } else {
      console.log('⚠️ Admin user not found in migrated data');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await mysqlConnection.end();
  }
}

migrateUsers().then(() => {
  console.log('🎉 Users migration complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
