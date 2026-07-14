import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const BUCKET_NAME = "backups";
const KEEP_LAST = 7;

let _supabase = null;
let _bucketEnsured = false;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
  }
  return _supabase;
}

async function ensureBucket() {
  if (_bucketEnsured) return;
  const supabase = getSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET_NAME)) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
    });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
  }
  _bucketEnsured = true;
}

export async function listBackups() {
  try {
    await ensureBucket();
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list();
    if (error) return [];

    return data
      .filter(f => f.name.startsWith("backup_") && f.name.endsWith(".sql"))
      .map(f => ({
        filename: f.name,
        size: f.metadata?.size || 0,
        createdAt: f.created_at || f.updated_at,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error("[backup] listBackups error:", err.message);
    return [];
  }
}

async function rotate() {
  const all = await listBackups();
  if (all.length > KEEP_LAST) {
    const toDelete = all.slice(KEEP_LAST).map(b => b.filename);
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(toDelete);
    if (error) console.error("[backup] rotate cleanup error:", error.message);
    else console.log(`[backup] Cleaned up ${toDelete.length} old backup(s)`);
  }
}

export async function runBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${ts}.sql`;

  try {
    await ensureBucket();
    const supabase = getSupabase();

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

    const sizeBytes = Buffer.byteLength(backupContent, 'utf8');
    if (sizeBytes < 100) throw new Error("Backup content too small or empty");

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, backupContent, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    console.log(`[backup] Uploaded ${filename} (${(sizeBytes / 1024).toFixed(1)} KB)`);
    await rotate();
    return { success: true, filename, size: sizeBytes };
  } catch (err) {
    console.error("[backup] Failed:", err.message);
    return { success: false, error: err.message };
  }
}

export async function downloadBackup(filename) {
  await ensureBucket();
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filename);
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBackup(filename) {
  await ensureBucket();
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filename]);
  if (error) throw new Error(error.message);
}

let _schedulerStarted = false;

export function startBackupScheduler() {
  if (_schedulerStarted) return;
  _schedulerStarted = true;

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
