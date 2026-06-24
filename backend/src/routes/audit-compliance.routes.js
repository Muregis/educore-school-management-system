import { Router } from "express";
import { AuditService } from "../core/services/AuditService.js";

const router = Router();
const auditService = new AuditService();

// Log compliance audit
router.post("/compliance", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await auditService.logComplianceAudit(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 400);
  }
});

// Get compliance audit logs
router.get("/compliance/logs", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const filters = req.query;
    const result = await auditService.getComplianceAuditLogs(schoolId, filters);
    res.success(result);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 500);
  }
});

// Create change request
router.post("/change-requests", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await auditService.createChangeRequest(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 400);
  }
});

// Approve change request
router.put("/change-requests/:requestId/approve", async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await auditService.approveChangeRequest(requestId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 400);
  }
});

// Reject change request
router.put("/change-requests/:requestId/reject", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const result = await auditService.rejectChangeRequest(requestId, reason, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 400);
  }
});

// Get pending change requests
router.get("/change-requests/pending", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await auditService.getPendingChangeRequests(schoolId);
    res.success(result);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 500);
  }
});

// Create retention policy
router.post("/retention-policies", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await auditService.createRetentionPolicy(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 400);
  }
});

// Get retention policies
router.get("/retention-policies", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await auditService.getRetentionPolicies(schoolId);
    res.success(result);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 500);
  }
});

// Check data retention compliance
router.get("/compliance/retention-check", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await auditService.checkDataRetentionCompliance(schoolId);
    res.success(result);
  } catch (error) {
    res.error('AUDIT_ERROR', error.message, {}, 500);
  }
});

export default router;
