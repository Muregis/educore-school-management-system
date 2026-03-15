import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

  router.get("/health", async (req, res, next) => {
    try {
      const [[nowRow]] = await pool.query("SELECT NOW() AS now");
      const [[dbRow]] = await pool.query("SELECT DATABASE() AS db");

    let lessonPlansTable = null;
    try {
      const [[t]] = await pool.query(
        `SELECT COUNT(*) AS n
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = 'lesson_plans'`
      );
      lessonPlansTable = Number(t?.n || 0) > 0;
    } catch {
      // ignore (permissions / info_schema disabled)
    }

    let activityLogsTable = null;
    try {
      const [[t]] = await pool.query(
        `SELECT COUNT(*) AS n
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = 'activity_logs'`
      );
      activityLogsTable = Number(t?.n || 0) > 0;
    } catch {
      // ignore (permissions / info_schema disabled)
    }

    const payload = {
      ok: true,
      dbTime: nowRow?.now,
      db: dbRow?.db,
      lessonPlansTable,
      activityLogsTable,
    };

    // Helpful dev diagnostics (avoid leaking details in production)
    if (process.env.NODE_ENV !== "production") {
      try {
        // OLD: Exposing global statistics is a security risk in multi-tenant system
    // const [[{ usersCount }]] = await pool.query(`SELECT COUNT(*) AS usersCount FROM users WHERE is_deleted = 0`);
    // const [[{ schoolsCount }]] = await pool.query(`SELECT COUNT(*) AS schoolsCount FROM schools WHERE is_deleted = 0`);
    // payload.usersCount = Number(usersCount || 0);
    // payload.schoolsCount = Number(schoolsCount || 0);
    // Security: Remove global stats to prevent cross-tenant information disclosure
      } catch {
        // ignore (tables might not exist yet)
      }
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
