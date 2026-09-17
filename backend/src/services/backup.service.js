import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const BUCKET_NAME = "backups";
const KEEP_LAST = 7;

// Columns that must never leave the database in a tenant-downloadable artifact.
const SENSITIVE_COLUMNS = new Set([
  "password",
  "password_hash",
  "two_factor_secret",
  "two_factor_backup_codes",
  "reset_token",
  "reset_token_expires",
  "refresh_token",
  "api_key",
  "key_hash",
  "secret",
  "secret_key",
  "access_token",
  "session_token",
  "webhook_secret",
  "consumer_secret",
  "paystack_secret_key",
  "mpesa_consumer_secret",
  "mpesa_passkey",
]);

export const BACKUP_FILENAME_RE = /^backup_school\d+_[\d\-T]+\.sql$/;

export function normalizeSchoolId(schoolId) {
  const id = Number(schoolId);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("A valid school context is required for backups");
  }
  return id;
}

// Every backup object lives under a per-tenant prefix so one school can never
// list, download or delete another school's artifacts.
function tenantPrefix(schoolId) {
  return `school_${normalizeSchoolId(schoolId)}`;
}

function tenantPath(schoolId, filename) {
  return `${tenantPrefix(schoolId)}/${filename}`;
}

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

export async function listBackups(schoolId) {
  const prefix = tenantPrefix(schoolId);
  try {
    await ensureBucket();
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(prefix);
    if (error) return [];

    return data
      .filter(f => BACKUP_FILENAME_RE.test(f.name))
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

async function rotate(schoolId) {
  const all = await listBackups(schoolId);
  if (all.length > KEEP_LAST) {
    const toDelete = all.slice(KEEP_LAST).map(b => tenantPath(schoolId, b.filename));
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(toDelete);
    if (error) console.error("[backup] rotate cleanup error:", error.message);
    else console.log(`[backup] Cleaned up ${toDelete.length} old backup(s)`);
  }
}

export async function runBackup(schoolId) {
  const tenantId = normalizeSchoolId(schoolId);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_school${tenantId}_${ts}.sql`;

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
    backupContent += `-- School: ${tenantId}\n`;
    backupContent += `-- Database: Supabase/PostgreSQL\n`;
    backupContent += `-- Note: scoped to a single tenant; credential columns are excluded\n\n`;

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('school_id', tenantId)
          .is('is_deleted', false)
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(10000);

        if (error) {
          // Fail closed: a table we cannot scope to the tenant is skipped
          // rather than dumped globally.
          console.warn(`[backup] Warning: Could not backup table ${table}:`, error.message);
          backupContent += `-- Skipped table ${table}: not exported\n\n`;
          continue;
        }

        if (data && data.length > 0) {
          const columns = Object.keys(data[0]).filter(col => !SENSITIVE_COLUMNS.has(col.toLowerCase()));
          if (columns.length === 0) {
            backupContent += `-- Table: ${table} (only sensitive columns, skipped)\n\n`;
            continue;
          }

          backupContent += `-- Table: ${table} (${data.length} records)\n`;
          backupContent += `INSERT INTO ${table} (`;
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
        backupContent += `-- Skipped table ${table}: not exported\n\n`;
      }
    }

    const sizeBytes = Buffer.byteLength(backupContent, 'utf8');
    if (sizeBytes < 100) throw new Error("Backup content too small or empty");

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(tenantPath(tenantId, filename), backupContent, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    console.log(`[backup] Uploaded ${filename} for school ${tenantId} (${(sizeBytes / 1024).toFixed(1)} KB)`);
    await rotate(tenantId);
    return { success: true, filename, size: sizeBytes };
  } catch (err) {
    console.error("[backup] Failed:", err.message);
    return { success: false, error: err.message };
  }
}

export async function downloadBackup(schoolId, filename) {
  await ensureBucket();
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(tenantPath(schoolId, filename));
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBackup(schoolId, filename) {
  await ensureBucket();
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([tenantPath(schoolId, filename)]);
  if (error) throw new Error(error.message);
}

// Scheduled backups run one tenant-scoped dump per school.
export async function runScheduledBackups() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("schools").select("school_id");
  if (error) {
    console.error("[backup] Could not list schools for scheduled backup:", error.message);
    return;
  }
  for (const school of data || []) {
    await runBackup(school.school_id);
  }
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
      console.log("[backup] Running scheduled daily backups...");
      await runScheduledBackups();
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}
