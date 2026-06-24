import { Router } from "express";
import { ReportingService } from "../core/services/ReportingService.js";

const router = Router();
const reportingService = new ReportingService();

// Enrollment report
router.get("/enrollment", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const filters = req.query;
    const result = await reportingService.generateEnrollmentReport(schoolId, filters);
    res.success(result);
  } catch (error) {
    res.error('REPORTING_ERROR', error.message, {}, 500);
  }
});

// Financial report
router.get("/financial", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { start_date, end_date } = req.query;
    const result = await reportingService.generateFinancialReport(schoolId, start_date, end_date);
    res.success(result);
  } catch (error) {
    res.error('REPORTING_ERROR', error.message, {}, 500);
  }
});

// Attendance report
router.get("/attendance", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { start_date, end_date, class_id } = req.query;
    const result = await reportingService.generateAttendanceReport(schoolId, start_date, end_date, class_id);
    res.success(result);
  } catch (error) {
    res.error('REPORTING_ERROR', error.message, {}, 500);
  }
});

// Academic performance report
router.get("/academic", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { exam_id } = req.query;
    const result = await reportingService.generateAcademicReport(schoolId, exam_id);
    res.success(result);
  } catch (error) {
    res.error('REPORTING_ERROR', error.message, {}, 500);
  }
});

// Dashboard summary
router.get("/dashboard", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await reportingService.generateDashboardSummary(schoolId);
    res.success(result);
  } catch (error) {
    res.error('REPORTING_ERROR', error.message, {}, 500);
  }
});

export default router;
