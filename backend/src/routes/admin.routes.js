import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { adminActionRateLimit, passwordResetRateLimit } from "../middleware/rateLimit.js";
import { runBackup, listBackups, downloadBackup, deleteBackup, BACKUP_FILENAME_RE } from "../services/backup.service.js";
import { logActivity } from "../helpers/activity.logger.js";
import { rejectWeakPassword } from "../helpers/password-policy.helper.js";
import { AdminService } from "../services/admin.service.js";
import { supabase } from "../config/supabaseClient.js";
import { logTenantContext, logTenantQuery } from "../helpers/tenant-debug.logger.js";

const router  = Router();

router.use(authRequired);
router.use(requireRoles("admin", "director", "superadmin"));
// Backups are tenant artifacts: the school always comes from the session and a
// filename is only addressable by the school that owns it.
function tenantSchoolId(req) {
  const id = Number(req.user?.school_id ?? req.user?.schoolId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function backupContext(req, res) {
  const schoolId = tenantSchoolId(req);
  if (!schoolId) {
    res.status(400).json({ message: "No active school context" });
    return null;
  }
  const { filename } = req.params;
  if (filename !== undefined &&
      (!BACKUP_FILENAME_RE.test(filename) || !filename.startsWith(`backup_school${schoolId}_`))) {
    res.status(404).json({ message: "Backup not found" });
    return null;
  }
  return { schoolId, filename };
}

// ── GET /api/admin/backups ────────────────────────────────────────────────────
router.get("/backups", async (req, res, next) => {
  try {
    const ctx = backupContext(req, res);
    if (!ctx) return;
    const backups = (await listBackups(ctx.schoolId)).map(b => ({
      filename:  b.filename,
      sizeKb:    Math.round(b.size / 1024),
      createdAt: b.createdAt,
    }));
    res.json({ backups, count: backups.length });
  } catch (err) { next(err); }
});

// ── POST /api/admin/backups ───────────────────────────────────────────────────
router.post("/backups", async (req, res, next) => {
  try {
    const ctx = backupContext(req, res);
    if (!ctx) return;
    const result = await runBackup(ctx.schoolId);
    if (!result.success) return res.status(500).json({ message: "Backup failed" });
    logActivity(req, {
      action: "admin.backup.create",
      entity: "backup",
      entityId: result.filename,
      description: `Backup created for school ${ctx.schoolId}`,
    });
    res.status(201).json({
      message:  "Backup created successfully",
      filename: result.filename,
      sizeKb:   Math.round(result.size / 1024),
    });
  } catch (err) { next(err); }
});

// ── GET /api/admin/backups/:filename/download ─────────────────────────────────
router.get("/backups/:filename/download", async (req, res, next) => {
  try {
    const ctx = backupContext(req, res);
    if (!ctx) return;
    const blob = await downloadBackup(ctx.schoolId, ctx.filename);
    const buffer = Buffer.from(await blob.arrayBuffer());
    logActivity(req, {
      action: "admin.backup.download",
      entity: "backup",
      entityId: ctx.filename,
      description: `Backup downloaded for school ${ctx.schoolId}`,
    });
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${ctx.filename}"`);
    res.send(buffer);
  } catch (err) {
    if (err.message.includes("not found") || err.message.includes("404")) {
      return res.status(404).json({ message: "Backup not found" });
    }
    next(err);
  }
});

// ── DELETE /api/admin/backups/:filename ───────────────────────────────────────
router.delete("/backups/:filename", async (req, res, next) => {
  try {
    const ctx = backupContext(req, res);
    if (!ctx) return;
    await deleteBackup(ctx.schoolId, ctx.filename);
    logActivity(req, {
      action: "admin.backup.delete",
      entity: "backup",
      entityId: ctx.filename,
      description: `Backup deleted for school ${ctx.schoolId}`,
    });
    res.json({ deleted: true, filename: ctx.filename });
  } catch (err) {
    if (err.message.includes("not found") || err.message.includes("404")) {
      return res.status(404).json({ message: "Backup not found" });
    }
    next(err);
  }
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

      if (await rejectWeakPassword(res, newPassword, { schoolId: req.user?.school_id ?? req.user?.schoolId })) {
        return;
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
// Directors can use ?schoolId=X to query any school, or omit to get all schools
router.get("/users", async (req, res, next) => {
  try {
    const { schoolId: userSchoolId, role } = req.user;
    const { schoolId: querySchoolId, all } = req.query;
    
    // Directors/superadmins can query any school or all schools
    let targetSchoolId = userSchoolId;
    if ((role === 'director' || role === 'superadmin') && querySchoolId) {
      targetSchoolId = Number(querySchoolId);
    }
    
    // If director requests all schools, fetch from all accessible schools
    if ((role === 'director' || role === 'superadmin') && all === 'true') {
      const { getAccessibleSchoolIds } = await import('../services/branch.service.js');
      const accessibleIds = await getAccessibleSchoolIds(req.user.user_id, userSchoolId);
      
      // Get users from all accessible schools
      const allUsersData = await AdminService.getUserManagementDataMultiSchool(accessibleIds);
      return res.json(allUsersData);
    }
    
    const userData = await AdminService.getUserManagementData(targetSchoolId);
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

export default router;
