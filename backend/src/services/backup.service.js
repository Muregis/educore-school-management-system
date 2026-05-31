import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const BACKUP_DIR = path.resolve("backups");
const KEEP_LAST = 7;

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ── List backups (newest first) ───────────────────────────────────────────────
export function listBackups() {
  ensureDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("backup_") && f.endsWith(".sql"))
    .map(filename => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return { filename, size: stat.size, createdAt: stat.mtime };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ── Delete old backups beyond KEEP_LAST ───────────────────────────────────────
function rotate() {
  const all = listBackups();
  if (all.length > KEEP_LAST) {
    all.slice(KEEP_LAST).forEach(b => {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, b.filename));
        console.log(`[backup] Deleted old backup: ${b.filename}`);
      } catch (_) {}
    });
  }
}

// ── Run one backup using Supabase ─────────────────────────────────────────────
export async function runBackup() {
  ensureDir();

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${ts}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  try {
    // Initialize Supabase client with service role key for full access
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);

    // List of tables to backup
    const tables = [
      'schools', 'classes', 'students', 'teachers', 'subjects',
      'enrollments', 'grades', 'attendance', 'payments', 'invoices',
      'users', 'activity_logs', 'fee_structures', 'exam_results',
      'student_guardians', 'student_transport', 'teacher_classes',
      'class_subjects', 'timetable_entries', 'transport_routes',
      'lesson_plans', 'announcements', 'notifications', 'sms_logs',
      'security_logs', 'hr_staff', 'hr_attendance', 'hr_leave',
      'hr_payslips', 'books', 'borrow_records', 'discipline_records',
      'report_cards', 'results', 'admissions', 'fee_balance_ledger'
    ];

    let backupContent = `-- EduCore Database Backup\n`;
    backupContent += `-- Generated: ${new Date().toISOString()}\n`;
    backupContent += `-- Database: Supabase/PostgreSQL\n\n`;

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .is('is_deleted', false)
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(10000);

        if (error) {
          console.warn(`[backup] Warning: Could not backup table ${table}:`, error.message);
          backupContent += `-- Warning: Could not backup table ${table}: ${error.message}\n\n`;
          continue;
        }

        if (data && data.length > 0) {
          backupContent += `-- Table: ${table} (${data.length} records)\n`;
          backupContent += `INSERT INTO ${table} (`;
          
          const columns = Object.keys(data[0]);
          backupContent += columns.join(', ') + ') VALUES\n';
          
          data.forEach((row, index) => {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') {
                // Escape single quotes for SQL
                return `'${val.replace(/'/g, "''")}'`;
              }
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return val;
            });
            backupContent += `  (${values.join(', ')})${index < data.length - 1 ? ',' : ';'}\n`;
          });
          backupContent += '\n';
        } else {
          backupContent += `-- Table: ${table} (no records)\n\n`;
        }
      } catch (err) {
        console.warn(`[backup] Warning: Error backing up table ${table}:`, err.message);
        backupContent += `-- Warning: Error backing up table ${table}: ${err.message}\n\n`;
      }
    }

    // Write backup file
    fs.writeFileSync(filepath, backupContent, 'utf8');

    const stat = fs.existsSync(filepath) ? fs.statSync(filepath) : null;
    if (!stat || stat.size < 100) throw new Error("Backup file empty or missing");

    console.log(`[backup] ✅ ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
    rotate();
    return { success: true, filename, size: stat.size, filepath };
  } catch (err) {
    console.error("[backup] ❌ Failed:", err.message);
    if (fs.existsSync(filepath)) {
      try { fs.unlinkSync(filepath); } catch (_) {}
    }
    return { success: false, error: err.message };
  }
}

// ── Daily scheduler — fires at midnight ──────────────────────────────────────
let _started = false;

export function startBackupScheduler() {
  if (_started) return;
  _started = true;

  function scheduleNext() {
    const now  = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    const ms = next - now;
    console.log(`[backup] Next scheduled backup in ${(ms / 3600000).toFixed(1)}h`);
    setTimeout(async () => {
      console.log("[backup] Running scheduled daily backup...");
      await runBackup();
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}
