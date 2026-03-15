import mysql from "mysql2/promise";
import { env } from "../config/env.js";

async function run() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: env.dbHost,
      user: env.dbUser,
      password: env.dbPassword,
      database: env.dbName,
    });

    console.log("Connected to database:", env.dbName);

    // 1. hr_attendance Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance (
        attendance_id INT AUTO_INCREMENT PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        staff_id INT NOT NULL,
        date DATE NOT NULL,
        status ENUM('Present','Absent','Late','Half-day') DEFAULT 'Present',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_hr_attendance (school_id, staff_id, date),
        FOREIGN KEY (staff_id) REFERENCES hr_staff(staff_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ hr_attendance table ensured.");

    // 2. hr_payslips Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS hr_payslips (
        payslip_id INT AUTO_INCREMENT PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        staff_id INT NOT NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        basic_salary DECIMAL(10,2) DEFAULT 0.00,
        allowances DECIMAL(10,2) DEFAULT 0.00,
        deductions DECIMAL(10,2) DEFAULT 0.00,
        net_pay DECIMAL(10,2) DEFAULT 0.00,
        status ENUM('Draft','Paid') DEFAULT 'Draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_hr_payslip (school_id, staff_id, month, year),
        FOREIGN KEY (staff_id) REFERENCES hr_staff(staff_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ hr_payslips table ensured.");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    if (connection) await connection.end();
    process.exit(0);
  }
}

run();
