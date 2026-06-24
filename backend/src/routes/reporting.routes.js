import { Router } from "express";
import { ReportingService } from "../core/services/ReportingService.js";
import { isMissingTableError, handleMissingTable } from "../utils/missingTableError.js";

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
    if (isMissingTableError(error)) {
      return res.success({
        total_students: 0,
        by_class: {},
        by_gender: {},
        by_status: {},
        generated_at: new Date().toISOString()
      });
    }
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
    if (isMissingTableError(error)) {
      return res.success({
        total_collected: 0,
        total_transactions: 0,
        by_payment_method: {},
        by_status: {},
        period: { start: start_date, end: end_date },
        generated_at: new Date().toISOString()
      });
    }
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
    if (isMissingTableError(error)) {
      return res.success({
        total_records: 0,
        total_present: 0,
        total_absent: 0,
        total_late: 0,
        attendance_rate: 0,
        by_date: {},
        period: { start: start_date, end: end_date },
        generated_at: new Date().toISOString()
      });
    }
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
    if (isMissingTableError(error)) {
      return res.success({
        total_students: 0,
        average_marks: 0,
        highest_marks: 0,
        lowest_marks: 0,
        pass_count: 0,
        fail_count: 0,
        pass_rate: 0,
        grade_distribution: {},
        generated_at: new Date().toISOString()
      });
    }
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
    if (isMissingTableError(error)) {
      return res.success({
        students: { total: 0, active: 0 },
        finance: { total_payments: 0, total_revenue: 0 },
        generated_at: new Date().toISOString()
      });
    }
    res.error('REPORTING_ERROR', error.message, {}, 500);
  }
});

export default router;
