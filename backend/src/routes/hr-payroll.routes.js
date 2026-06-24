import { Router } from "express";
import { HRService } from "../core/services/HRService.js";

const router = Router();
const hrService = new HRService();

// Create payroll period
router.post("/payroll-periods", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await hrService.createPayrollPeriod(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 400);
  }
});

// Set current payroll period
router.put("/payroll-periods/:id/current", async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const result = await hrService.setCurrentPayrollPeriod(id, schoolId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 400);
  }
});

// Create payroll
router.post("/payroll", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await hrService.createPayroll(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 400);
  }
});

// Process payroll for period
router.post("/payroll/period/:payrollPeriodId/process", async (req, res) => {
  try {
    const { payrollPeriodId } = req.params;
    const result = await hrService.processPayrollForPeriod(payrollPeriodId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 400);
  }
});

// Process payroll
router.put("/payroll/:id/process", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await hrService.processPayroll(id, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 400);
  }
});

// Mark payroll as paid
router.put("/payroll/:id/paid", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await hrService.markPayrollAsPaid(id, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 400);
  }
});

// Get payroll summary
router.get("/payroll/period/:payrollPeriodId/summary", async (req, res) => {
  try {
    const { payrollPeriodId } = req.params;
    const result = await hrService.getPayrollSummary(payrollPeriodId);
    res.success(result);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 500);
  }
});

// Get staff payroll history
router.get("/payroll/staff/:staffId/history", async (req, res) => {
  try {
    const { staffId } = req.params;
    const result = await hrService.getStaffPayrollHistory(staffId);
    res.success(result);
  } catch (error) {
    res.error('HR_ERROR', error.message, {}, 500);
  }
});

export default router;
