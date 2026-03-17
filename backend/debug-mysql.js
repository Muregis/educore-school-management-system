import './src/config/env.js';
import mysql from 'mysql2/promise';

console.log('=== MySQL CREDENTIALS DEBUG ===');
console.log('DB_HOST:', process.env.DB_HOST || '127.0.0.1');
console.log('DB_PORT:', process.env.DB_PORT || 3307);
console.log('DB_USER:', process.env.DB_USER || 'root');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'EMPTY');
console.log('DB_NAME:', process.env.DB_NAME || 'educore_db');

// Try to connect with default credentials
async function testMySQL() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'educore_db',
    });
    
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('MySQL connection SUCCESS:', rows[0]);
    await connection.end();
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    
    // Try without database first
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
      });
      
      const [rows] = await connection.execute('SELECT 1 as test');
      console.log('MySQL connection (no DB) SUCCESS:', rows[0]);
      
      // Check if database exists
      const [databases] = await connection.execute('SHOW DATABASES LIKE "educore_db"');
      console.log('educore_db exists:', databases.length > 0);
      
      await connection.end();
    } catch (error2) {
      console.error('MySQL connection (no DB) failed:', error2.message);
    }
  }
}

testMySQL();
