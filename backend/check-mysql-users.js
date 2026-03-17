import './src/config/env.js';
import mysql from 'mysql2/promise';

async function checkMySQLUsers() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '0101',
      database: process.env.DB_NAME || 'educore_db',
    });
    
    const [rows] = await connection.execute('SELECT user_id, email, role FROM users WHERE is_deleted = 0 LIMIT 5');
    console.log('MySQL users:', rows);
    
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM users WHERE is_deleted = 0');
    console.log('Total MySQL users:', count[0].total);
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkMySQLUsers();
