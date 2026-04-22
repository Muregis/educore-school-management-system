import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkMySQL() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    const tables = ['schools', 'users', 'students', 'teachers', 'classes', 'subjects'];
    console.log('--- MYSQL DATA STATUS ---');
    for (const table of tables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`${table}: ${rows[0].count} rows found`);
      } catch (e) {
        console.log(`${table}: Table missing or error`);
      }
    }
    await connection.end();
  } catch (err) {
    console.log('MySQL Connection failed:', err.message);
  }
}

checkMySQL();
