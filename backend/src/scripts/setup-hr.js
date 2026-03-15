import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

const pgPool = new Pool({
  host: env.dbHost || process.env.PG_HOST || "127.0.0.1",
  port: env.dbPort || process.env.PG_PORT || 5432,
  user: env.dbUser || process.env.PG_USER || "postgres",
  password: env.dbPassword || process.env.PG_PASSWORD || "",
  database: env.dbName || process.env.PG_NAME || "postgres",
  max: 10
});

async function run() {
  let client;
  try {
    client = await pgPool.connect();

    console.log("Connected to database:", env.dbName || process.env.PG_NAME || "postgres");

    // 1. hr_attendance Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance (
        attendance_id SERIAL PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        staff_id INTEGER NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'Present' CHECK (status IN ('Present','Absent','Late','Half-day')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (school_id, staff_id, date),
        FOREIGN KEY (staff_id) REFERENCES hr_staff(staff_id) ON DELETE CASCADE
      );
    `);
    console.log("✅ hr_attendance table ensured.");

    // 2. hr_payslips Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payslips (
        payslip_id SERIAL PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        staff_id INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        basic_salary DECIMAL(10,2) DEFAULT 0.00,
        allowances DECIMAL(10,2) DEFAULT 0.00,
        deductions DECIMAL(10,2) DEFAULT 0.00,
        net_pay DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft','Paid')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (school_id, staff_id, month, year),
        FOREIGN KEY (staff_id) REFERENCES hr_staff(staff_id) ON DELETE CASCADE
      );
    `);
    console.log("✅ hr_payslips table ensured.");

    // Create trigger to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_attendance_updated_at ON hr_attendance;
      CREATE TRIGGER update_hr_attendance_updated_at
        BEFORE UPDATE ON hr_attendance
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_payslips_updated_at ON hr_payslips;
      CREATE TRIGGER update_hr_payslips_updated_at
        BEFORE UPDATE ON hr_payslips
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log("✅ Update triggers created.");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    if (client) {
      client.release();
    }
    await pgPool.end();
    process.exit(0);
  }
}

run();
