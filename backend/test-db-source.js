import './src/config/env.js';
import { pool, mysqlPool } from './src/config/db.js';

async function testDatabaseSource() {
  try {
    console.log('🔍 Testing which database source is used for login...');
    
    const email = 'admin@greenfield.ac.ke';
    const schoolId = 1;
    
    // Test Supabase
    console.log('1️⃣ Testing Supabase...');
    try {
      const { data: users, error } = await pool
        .from('users')
        .select('user_id, email, role')
        .eq('email', email)
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .limit(1);
      
      if (!error && users && users.length > 0) {
        console.log('✅ Supabase has the user:', users[0]);
        console.log('🎯 Login should use SUPABASE');
      } else {
        console.log('❌ Supabase error or no user:', error?.message || 'No user found');
      }
    } catch (err) {
      console.log('❌ Supabase exception:', err.message);
    }
    
    // Test MySQL
    console.log('2️⃣ Testing MySQL...');
    try {
      const [rows] = await mysqlPool.query(
        'SELECT user_id, email, role FROM users WHERE email = ? AND school_id = ? AND is_deleted = 0 LIMIT 1',
        [email, schoolId]
      );
      
      if (rows.length > 0) {
        console.log('✅ MySQL has the user:', rows[0]);
      } else {
        console.log('❌ MySQL has no user');
      }
    } catch (err) {
      console.log('❌ MySQL exception:', err.message);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testDatabaseSource();
