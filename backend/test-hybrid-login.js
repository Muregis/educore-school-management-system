import './src/config/env.js';
import { pool, mysqlPool } from './src/config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function testHybridLogin() {
  try {
    console.log('🔄 Testing hybrid login (Supabase → MySQL fallback)...');
    
    const email = 'admin@greenfield.ac.ke';
    const password = 'admin123';
    const schoolId = 1;
    
    // Try Supabase first
    console.log('1️⃣ Trying Supabase...');
    try {
      const { data: users, error } = await pool
        .from('users')
        .select('user_id, full_name, email, password_hash, role, status')
        .eq('email', email)
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .limit(1);
      
      if (!error && users && users.length > 0) {
        const user = users[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (valid) {
          console.log('✅ Supabase login successful!');
          console.log('User:', { user_id: user.user_id, email: user.email, role: user.role });
          return 'supabase';
        }
      }
      console.log('❌ Supabase login failed');
    } catch (err) {
      console.log('❌ Supabase error:', err.message);
    }
    
    // Fallback to MySQL
    console.log('2️⃣ Falling back to MySQL...');
    try {
      const [rows] = await mysqlPool.query(
        `SELECT user_id, full_name, email, password_hash, role, status
         FROM users
         WHERE email = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
        [email, schoolId]
      );
      
      if (rows.length > 0) {
        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (valid) {
          console.log('✅ MySQL login successful!');
          console.log('User:', { user_id: user.user_id, email: user.email, role: user.role });
          return 'mysql';
        }
      }
      console.log('❌ MySQL login failed');
    } catch (err) {
      console.log('❌ MySQL error:', err.message);
    }
    
    console.log('❌ Both login methods failed');
    return 'none';
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return 'error';
  }
}

testHybridLogin().then(result => {
  console.log(`\n🎯 Result: ${result}`);
  process.exit(0);
});
