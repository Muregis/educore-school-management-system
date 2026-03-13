import { Router } from "express";
import path from "path";
import fs from "fs";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { runBackup, listBackups } from "../services/backup.service.js";

const router  = Router();
const BACKUP_DIR = path.resolve("backups");

router.use(authRequired);
router.use(requireRoles("admin"));

// ── GET /api/admin/backups ────────────────────────────────────────────────────
router.get("/backups", (req, res) => {
  const backups = listBackups().map(b => ({
    filename:  b.filename,
    sizeKb:    Math.round(b.size / 1024),
    createdAt: b.createdAt,
  }));
  res.json({ backups, count: backups.length });
});

// ── POST /api/admin/backups ───────────────────────────────────────────────────
router.post("/backups", async (req, res, next) => {
  try {
    const result = await runBackup();
    if (!result.success) return res.status(500).json({ message: result.error });
    res.status(201).json({
      message:  "Backup created successfully",
      filename: result.filename,
      sizeKb:   Math.round(result.size / 1024),
    });
  } catch (err) { next(err); }
});

// ── GET /api/admin/backups/:filename/download ─────────────────────────────────
router.get("/backups/:filename/download", (req, res) => {
  const { filename } = req.params;
  // Sanitise — only allow backup_*.sql filenames to prevent path traversal
  if (!/^backup_[\d\-T]+\.sql$/.test(filename)) {
    return res.status(400).json({ message: "Invalid filename" });
  }
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ message: "Backup not found" });
  res.download(filepath, filename);
});

// ── DELETE /api/admin/backups/:filename ───────────────────────────────────────
router.delete("/backups/:filename", (req, res) => {
  const { filename } = req.params;
  if (!/^backup_[\d\-T]+\.sql$/.test(filename)) {
    return res.status(400).json({ message: "Invalid filename" });
  }
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ message: "Backup not found" });
  fs.unlinkSync(filepath);
  res.json({ deleted: true, filename });
});

export default router;
