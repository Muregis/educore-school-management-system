import { Router } from "express";
import path from "path";
import fs from "fs";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { adminActionRateLimit, passwordResetRateLimit } from "../middleware/rateLimit.js";
import { runBackup, listBackups } from "../services/backup.service.js";
import { AdminService } from "../services/admin.service.js";
import { supabase } from "../config/supabaseClient.js";
import { logTenantContext, logTenantQuery } from "../helpers/tenant-debug.logger.js";

const router  = Router();
const BACKUP_DIR = path.resolve("backups");

router.use(authRequired);
router.use(requireRoles("admin"));

async function softResetTable(table, schoolId, options = {}) {
  const {
    extraFilters = [],
    select = "school_id",
    supportsSoftDelete = true,
    allowMissingTable = false,
  } = options;

  const applyFilters = (query) => {
    let nextQuery = query.eq("school_id", schoolId);
    for (const filter of extraFilters) {
      if (filter.type === "in") {
        nextQuery = nextQuery.in(filter.column, filter.values);
        continue;
      }
      nextQuery = nextQuery.eq(filter.column, filter.value);
    }
    return nextQuery;
  };

  if (supportsSoftDelete) {
    const softDeleteVariants = [
      { payload: { is_deleted: true, updated_at: new Date().toISOString() }, requireActiveOnly: true, mode: "soft" },
      { payload: { is_deleted: true }, requireActiveOnly: true, mode: "soft-no-updated-at" },
      { payload: { updated_at: new Date().toISOString() }, requireActiveOnly: false, mode: "touch-updated-at" },
    ];

    for (const variant of softDeleteVariants) {
      let softDeleteQuery = applyFilters(
        supabase
          .from(table)
          .update(variant.payload)
      );

      if (variant.requireActiveOnly) {
        softDeleteQuery = softDeleteQuery.eq("is_deleted", false);
      }

      const { data, error } = await softDeleteQuery.select(select);
      if (!error) {
        return { count: data?.length ?? 0, mode: variant.mode };
      }

      const message = String(error.message || "").toLowerCase();
      const missingColumn =
        message.includes("column") ||
        message.includes("does not exist") ||
        message.includes("could not find");
      const missingTable =
        error.code === "PGRST205" ||
        (message.includes(table) && message.includes("does not exist"));

      if (missingTable && allowMissingTable) {
        return { count: 0, mode: "missing-table" };
      }

      if (!missingColumn) {
        return { error };
      }
    }
  }

  const hardDeleteQuery = applyFilters(
    supabase
      .from(table)
      .delete()
  );

  const { data, error } = await hardDeleteQuery.select(select);
  if (error) {
    const message = String(error.message || "").toLowerCase();
    const missingTable =
      error.code === "PGRST205" ||
      (message.includes(table) && message.includes("does not exist"));
    if (missingTable && allowMissingTable) {
      return { count: 0, mode: "missing-table" };
    }
    return { error };
  }

  return { count: data?.length ?? 0, mode: "hard" };
}

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

// ── POST /api/admin/reset-password ─────────────────────────────────────────────
router.post("/reset-password", 
  passwordResetRateLimit, 
  adminActionRateLimit,
  async (req, res, next) => {
    try {
      const { userId, newPassword } = req.body;
      
      if (!userId || !newPassword) {
        return res.status(400).json({ 
          message: "userId and newPassword are required" 
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ 
          message: "Password must be at least 6 characters long" 
        });
      }

      const result = await AdminService.resetPassword(req.user, userId, newPassword, req);
      res.json(result);

    } catch (error) {
      next(error);
    }
  }
);

// ── POST /api/admin/impersonate/:userId ───────────────────────────────────────────
router.post("/impersonate/:userId", 
  adminActionRateLimit,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      const result = await AdminService.generateImpersonationToken(req.user, userId, req);
      res.json(result);

    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/admin/health ───────────────────────────────────────────────────────
router.get("/health", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const health = await AdminService.getSystemHealth(schoolId);
    res.json(health);
  } catch (error) {
    next(error);
  }
});

// ── GET /api/admin/activity-logs ─────────────────────────────────────────────────
router.get("/activity-logs", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { userId, action, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    
    const filters = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const logs = await AdminService.getActivityLogs(schoolId, filters, parseInt(page), parseInt(limit));
    res.json(logs);

  } catch (error) {
    next(error);
  }
});

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────────
router.get("/audit-logs", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { userId, action, entityType, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    
    const filters = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (entityType) filters.entityType = entityType;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const logs = await AdminService.getAuditLogs(schoolId, filters, parseInt(page), parseInt(limit));
    res.json(logs);

  } catch (error) {
    next(error);
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────────
router.get("/users", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const userData = await AdminService.getUserManagementData(schoolId);
    res.json(userData);
  } catch (error) {
    next(error);
  }
});

// ── POST /api/admin/users/bulk-update ───────────────────────────────────────────
router.post("/users/bulk-update", 
  adminActionRateLimit,
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { userIds, updates } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ 
          message: "userIds array is required" 
        });
      }

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ 
          message: "updates object is required" 
        });
      }

      const result = await AdminService.bulkUpdateUsers(schoolId, userIds, updates, req);
      res.json(result);

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/reset-demo-data - wipe demo data for current school only
router.post(
  "/reset-demo-data",
  adminActionRateLimit,
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const bodySchoolId = Number(req.body?.school_id);

      if (!Number.isInteger(bodySchoolId) || bodySchoolId < 1) {
        return res.status(400).json({ message: "Valid school_id is required" });
      }
      if (bodySchoolId !== Number(schoolId)) {
        return res.status(403).json({ message: "school_id does not match your tenant" });
      }

      logTenantContext("admin.reset_demo_data.request", req, { bodySchoolId });

      const deletedCounts = {};
      const deletionModes = {};
      const deleteOrder = [
        "student_ledger",
        "report_cards",
        "results",
        "attendance",
        "payments",
        "invoices",
        "discipline_records",
      ];

      for (const table of deleteOrder) {
        logTenantQuery("admin.reset_demo_data.delete", { table, schoolId: bodySchoolId });
        const result = await softResetTable(table, bodySchoolId, {
          allowMissingTable: true,
        });

        if (result.error) {
          return res.status(500).json({
            message: `Failed while resetting ${table}`,
            table,
            error: result.error.message,
            deletedCounts,
          });
        }

        deletedCounts[table] = result.count;
        deletionModes[table] = result.mode;
      }

      logTenantQuery("admin.reset_demo_data.soft_delete_portal_users", { table: "users", schoolId: bodySchoolId });
      const portalUserResult = await softResetTable("users", bodySchoolId, {
        extraFilters: [{ type: "in", column: "role", values: ["parent", "student"] }],
        select: "user_id",
      });

      if (portalUserResult.error) {
        return res.status(500).json({
          message: "Failed while resetting portal users",
          table: "users",
          error: portalUserResult.error.message,
          deletedCounts,
        });
      }

      deletedCounts.users = portalUserResult.count;
      deletionModes.users = portalUserResult.mode;

      logTenantQuery("admin.reset_demo_data.soft_delete_students", { table: "students", schoolId: bodySchoolId });
      const studentResetResult = await softResetTable("students", bodySchoolId, {
        select: "student_id",
      });

      if (studentResetResult.error) {
        return res.status(500).json({
          message: "Failed while resetting students",
          table: "students",
          error: studentResetResult.error.message,
          deletedCounts,
        });
      }

      deletedCounts.students = studentResetResult.count;
      deletionModes.students = studentResetResult.mode;

      return res.json({
        success: true,
        school_id: bodySchoolId,
        deletedCounts,
        deletionModes,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
