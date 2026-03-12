/**
 * Run with: node fix-passwords.js
 * Fixes all user passwords in the database to proper bcrypt hashes.
 * Portal users (parent/student) get their admission number as password.
 * Staff users get their role + "123" as password.
 */
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const pool = await mysql.createPool({
  host:     process.env.DB_HOST     || "127.0.0.1",
  port:     Number(process.env.DB_PORT || 3307),
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "0101",
  database: process.env.DB_NAME     || "educore_db",
});

const STAFF_PASSWORDS = {
  admin:     "admin123",
  teacher:   "teacher123",
  finance:   "finance123",
  hr:        "hr123",
  librarian: "librarian123",
};

async function run() {
  const [users] = await pool.query(
    `SELECT u.user_id, u.role, u.email, u.password_hash, u.student_id,
            s.admission_number
      FROM users u
      LEFT JOIN students s ON s.student_id = u.student_id
      WHERE u.is_deleted = 0`
  );

  let fixed = 0;
  for (const u of users) {
    let plainPassword;

    if (["parent","student"].includes(u.role)) {
      // Portal users: password = admission number
      plainPassword = u.admission_number || u.email?.split("@")[0] || "portal123";
    } else {
      // Staff: use known passwords or email prefix
      plainPassword = STAFF_PASSWORDS[u.role] || u.email?.split("@")[0] || "pass123";
    }

    // Check if already properly hashed
    const alreadyHashed = u.password_hash?.startsWith("$2");
    if (alreadyHashed) {
      const ok = await bcrypt.compare(plainPassword, u.password_hash);
      if (ok) { console.log(`✓ ${u.email || u.role} [${u.role}] — already correct`); continue; }
    }

    const hash = await bcrypt.hash(plainPassword, 10);
    await pool.query(`UPDATE users SET password_hash=? WHERE user_id=?`, [hash, u.user_id]);
    console.log(`✅ Fixed ${u.email || "user_"+u.user_id} [${u.role}] → password: "${plainPassword}"`);
    fixed++;
  }

  console.log(`\nDone. Fixed ${fixed} / ${users.length} accounts.`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });