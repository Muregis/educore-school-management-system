import { Router } from "express";
import { BackupService } from "../core/services/BackupService.js";

const router = Router();
const backupService = new BackupService();

// Create backup log
router.post("/backups", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await backupService.createBackupLog(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

// Complete backup
router.put("/backups/:backupId/complete", async (req, res) => {
  try {
    const { backupId } = req.params;
    const result = await backupService.completeBackupLog(backupId, req.body, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

// Fail backup
router.put("/backups/:backupId/fail", async (req, res) => {
  try {
    const { backupId } = req.params;
    const { error_message } = req.body;
    const result = await backupService.failBackupLog(backupId, error_message, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

// Get backup logs
router.get("/backups", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const filters = req.query;
    const result = await backupService.getBackupLogs(schoolId, filters);
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 500);
  }
});

// Get backup summary
router.get("/backups/summary", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await backupService.getBackupSummary(schoolId);
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 500);
  }
});

// Create restore log
router.post("/restores", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await backupService.createRestoreLog(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

// Complete restore
router.put("/restores/:restoreId/complete", async (req, res) => {
  try {
    const { restoreId } = req.params;
    const result = await backupService.completeRestoreLog(restoreId, req.body, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

// Get restore logs
router.get("/restores", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await backupService.getRestoreLogs(schoolId);
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 500);
  }
});

// Create DR plan
router.post("/dr-plans", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await backupService.createDRPlan(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

// Update DR plan
router.put("/dr-plans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await backupService.updateDRPlan(id, req.body, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

// Get DR plan
router.get("/dr-plans", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await backupService.getDRPlan(schoolId);
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 500);
  }
});

// Test DR plan
router.put("/dr-plans/:id/test", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await backupService.testDRPlan(id, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('BACKUP_ERROR', error.message, {}, 400);
  }
});

export default router;
