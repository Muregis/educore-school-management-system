import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { env } from "../config/env.js";

const execAsync  = promisify(exec);
const BACKUP_DIR = path.resolve("backups");
const KEEP_LAST  = 7;
const DUMP_BIN   = process.env.MYSQLDUMP_PATH || "mysqldump";

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

// ── Run one backup ────────────────────────────────────────────────────────────
export async function runBackup() {
  ensureDir();

  const ts       = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${ts}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const passArg = env.dbPassword ? `-p${env.dbPassword}` : "";
  const cmd = `${DUMP_BIN} -h ${env.dbHost} -P ${env.dbPort} -u ${env.dbUser} ${passArg} --single-transaction --routines --triggers --add-drop-table ${env.dbName} > "${filepath}"`;

  try {
    await execAsync(cmd, { shell: true });

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
