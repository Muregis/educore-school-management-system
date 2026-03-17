import './src/config/env.js';
import mysql from 'mysql2/promise';

async function checkIsDeletedValue() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '0101',
      database: process.env.DB_NAME || 'educore_db',
    });
    
    // Check the actual is_deleted values
    const [rows] = await connection.execute(
      'SELECT user_id, email, is_deleted FROM users WHERE email = ?',
      ['admin@greenfield.ac.ke']
    );
    
    console.log('User is_deleted value:', rows[0]);
    
    // Check what values exist in is_deleted column
    const [distinct] = await connection.execute(
      'SELECT DISTINCT is_deleted, COUNT(*) as count FROM users GROUP BY is_deleted'
    );
    console.log('All is_deleted values:', distinct);
    
    // Test the exact query from auth
    const [testRows] = await connection.execute(
      'SELECT user_id, full_name, email, password_hash, role, status FROM users WHERE email = ? AND school_id = ? AND is_deleted = 0 LIMIT 1',
      ['admin@greenfield.ac.ke', 1]
    );
    
    console.log('Auth query result:', testRows);
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkIsDeletedValue();
