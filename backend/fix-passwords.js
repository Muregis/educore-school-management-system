// Run from inside the backend folder:
// node fix-passwords.js

import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const pool = await mysql.createPool({
  host:     "127.0.0.1",
  port:     3307,
  user:     "root",
  password: "0101",
  database: "educore_db",
});

const updates = [
  // ── Staff ──────────────────────────────────────────────────────
  { email: "admin@greenfield.ac.ke",       password: "admin123"   },
  { email: "teacher@greenfield.ac.ke",     password: "teacher123" },
  { email: "finance@greenfield.ac.ke",     password: "finance123" },
  { email: "hr@greenfield.ac.ke",            password: "hr123"         },
  { email: "librarian@greenfield.ac.ke",     password: "librarian123"  },
  // ── Portal accounts ────────────────────────────────────────────
  { email: "adm-2020-001.parent@portal",   password: "parent123"  },
  { email: "adm-2020-001.student@portal",  password: "student123" },
  { email: "adm-2022-004.parent@portal",   password: "parent123"  },
  { email: "adm-2022-004.student@portal",  password: "student123" },
  { email: "adm-2019-002.parent@portal",   password: "parent123"  },
  { email: "adm-2019-002.student@portal",  password: "student123" },
  { email: "adm-2021-003.parent@portal",   password: "parent123"  },
  { email: "adm-2021-003.student@portal",  password: "student123" },
];

for (const u of updates) {
  const hash = await bcrypt.hash(u.password, 10);
  const [result] = await pool.query(
    "UPDATE users SET password_hash=? WHERE email=?",
    [hash, u.email]
  );
  console.log(`${result.affectedRows ? "✓" : "✗ MISS"} ${u.email} → ${result.affectedRows} row updated`);
}

console.log("\nAll passwords updated. You can now log in.");
await pool.end();