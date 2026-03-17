import './src/config/env.js';
import pg from 'pg';

const { Pool } = pg;

async function testConnection() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query('SELECT version()');
    console.log('SUCCESS:', result.rows[0]);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

testConnection();
