import './src/config/env.js';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function checkPasswordHash() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '0101',
      database: process.env.DB_NAME || 'educore_db',
    });
    
    const [rows] = await connection.execute(
      'SELECT user_id, email, password_hash, role FROM users WHERE email = ? AND is_deleted = 0',
      ['admin@greenfield.ac.ke']
    );
    
    if (rows.length > 0) {
      const user = rows[0];
      console.log('User found:', user);
      
      // Test password comparison
      const testPassword = 'admin123';
      console.log('Testing password:', testPassword);
      
      try {
        const isValid = await bcrypt.compare(testPassword, user.password_hash);
        console.log('Password comparison result:', isValid);
        
        // Test if it's a placeholder hash
        const isPlaceholder = user.password_hash.length < 50;
        console.log('Is placeholder hash:', isPlaceholder);
        
        if (isPlaceholder && testPassword === 'admin123') {
          console.log('✅ Should accept as default password');
        }
        
      } catch (error) {
        console.error('Password comparison error:', error.message);
      }
    } else {
      console.log('❌ User not found');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPasswordHash();
