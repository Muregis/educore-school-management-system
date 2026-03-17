import './src/config/env.js';
import pg from 'pg';

const { Pool } = pg;

async function testBasicConnection() {
  try {
    console.log('Testing connection to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'));
    
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Test basic connection
    const result = await pool.query('SELECT 1 as test');
    console.log('Basic connection SUCCESS:', result.rows[0]);
    
    // Test if users table exists
    try {
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      `);
      console.log('Users table exists:', tables.rows.length > 0);
    } catch (err) {
      console.log('Error checking users table:', err.message);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('CONNECTION ERROR:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testBasicConnection();
