// =====================================================
// NEW API ROUTES FOR EDUCORE UPGRADE
// Add these to your existing backend
// =====================================================

import express from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  AcademicYearService,
  TermService,
  TermTransitionService,
  StudentEnrollmentService,
  FeeBalanceService,
  DualWriteService,
  PromotionService,
  PermissionService
} from "../services/academicServices.js";

const router = express.Router();
router.use(authRequired);

// =====================================================
// ACADEMIC MANAGEMENT ROUTES
// =====================================================

// GET /api/academic/years - List academic years
router.get("/academic/years", requirePermission("academic.view"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { data: years, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', schoolId)
      .neq('is_deleted', true)
      .order('start_date', { ascending: false });

    if (error) throw error;
    res.json(years || []);
  } catch (err) {
    console.error('Error fetching academic years:', err);
    res.status(500).json({ message: "Failed to fetch academic years" });
  }
});

// GET /api/academic/years/current - Get current academic year
router.get("/academic/years/current", async (req, res) => {
  try {
    const { schoolId } = req.user;
    const year = await AcademicYearService.getCurrentYearWithFallback(schoolId);
    res.json(year);
  } catch (err) {
    console.error('Error fetching current academic year:', err);
    res.status(500).json({ message: "Failed to fetch current academic year" });
  }
});

// POST /api/academic/years - Create academic year
router.post("/academic/years", requirePermission("academic.manage"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const yearData = req.body;

    const year = await AcademicYearService.createYear(schoolId, yearData);
    res.json(year);
  } catch (err) {
    console.error('Error creating academic year:', err);
    res.status(500).json({ message: "Failed to create academic year" });
  }
});

// GET /api/academic/terms - List terms
router.get("/academic/terms", requirePermission("academic.view"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { data: terms, error } = await supabase
      .from('terms')
      .select(`
        *,
        academic_years!inner(year_label)
      `)
      .eq('school_id', schoolId)
      .neq('is_deleted', true)
      .order('term_order');

    if (error) throw error;
    res.json(terms || []);
  } catch (err) {
    console.error('Error fetching terms:', err);
    res.status(500).json({ message: "Failed to fetch terms" });
  }
});

// GET /api/academic/terms/current - Get current term
router.get("/academic/terms/current", async (req, res) => {
  try {
    const { schoolId } = req.user;
    const term = await TermService.getCurrentTermWithFallback(schoolId);
    res.json(term);
  } catch (err) {
    console.error('Error fetching current term:', err);
    res.status(500).json({ message: "Failed to fetch current term" });
  }
});

// PUT /api/academic/terms/:id/close - Close term
router.put("/academic/terms/:id/close", requirePermission("term.close"), async (req, res) => {
  try {
    const { schoolId, user_id } = req.user;
    const termId = req.params.id;

    const result = await TermTransitionService.closeTerm(schoolId, termId, user_id);
    res.json(result);
  } catch (err) {
    console.error('Error closing term:', err);
    res.status(500).json({ message: err.message || "Failed to close term" });
  }
});

// PUT /api/academic/terms/:id/open - Open term
router.put("/academic/terms/:id/open", requirePermission("term.open"), async (req, res) => {
  try {
    const { schoolId, user_id } = req.user;
    const termId = req.params.id;

    const result = await TermTransitionService.openTerm(schoolId, termId, user_id);
    res.json(result);
  } catch (err) {
    console.error('Error opening term:', err);
    res.status(500).json({ message: err.message || "Failed to open term" });
  }
});

// GET /api/academic/terms/:id/can-close - Check if term can be closed
router.get("/academic/terms/:id/can-close", requirePermission("term.close"), async (req, res) => {
  try {
    const termId = req.params.id;
    const eligibility = await TermService.canCloseTerm(termId);
    res.json(eligibility);
  } catch (err) {
    console.error('Error checking term closure:', err);
    res.status(500).json({ message: "Failed to check term closure eligibility" });
  }
});

// =====================================================
// STUDENT MANAGEMENT ROUTES
// =====================================================

// GET /api/students/:id/enrollments - Get enrollment history
router.get("/students/:id/enrollments", requirePermission("enrollment.view"), async (req, res) => {
  try {
    const studentId = req.params.id;
    const enrollments = await StudentEnrollmentService.getEnrollmentHistory(studentId);
    res.json(enrollments);
  } catch (err) {
    console.error('Error fetching enrollments:', err);
    res.status(500).json({ message: "Failed to fetch enrollment history" });
  }
});

// GET /api/students/:id/enrollment/current - Get current enrollment
router.get("/students/:id/enrollment/current", requirePermission("enrollment.view"), async (req, res) => {
  try {
    const studentId = req.params.id;
    const enrollment = await StudentEnrollmentService.getCurrentEnrollment(studentId);
    res.json(enrollment);
  } catch (err) {
    console.error('Error fetching current enrollment:', err);
    res.status(500).json({ message: "Failed to fetch current enrollment" });
  }
});

// GET /api/students/promotion-eligible - Get promotion-eligible students
router.get("/students/promotion-eligible", requirePermission("promotion.view"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.query;

    let query = supabase
      .from('student_enrollments')
      .select(`
        enrollment_id,
        enrollment_date,
        status,
        students:student_id(
          student_id,
          first_name,
          last_name,
          admission_number,
          class_name
        ),
        classes:class_id(class_name)
      `)
      .eq('is_current', true)
      .eq('status', 'active');

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Error fetching promotion-eligible students:', err);
    res.status(500).json({ message: "Failed to fetch promotion-eligible students" });
  }
});

// POST /api/students/:id/promote - Promote student
router.post("/students/:id/promote", requirePermission("promotion.approve"), async (req, res) => {
  try {
    const studentId = req.params.id;
    const { toClassId, reason } = req.body;
    const { user_id } = req.user;

    const result = await PromotionService.promoteStudent(studentId, toClassId, user_id, reason);
    res.json(result);
  } catch (err) {
    console.error('Error promoting student:', err);
    res.status(500).json({ message: err.message || "Failed to promote student" });
  }
});

// POST /api/students/bulk-promote - Bulk promote students
router.post("/students/bulk-promote", requirePermission("promotion.approve"), async (req, res) => {
  try {
    const { studentIds, toClassId, reason } = req.body;
    const { user_id } = req.user;

    const results = [];
    for (const studentId of studentIds) {
      try {
        const result = await PromotionService.promoteStudent(studentId, toClassId, user_id, reason);
        results.push({ studentId, success: true, result });
      } catch (error) {
        results.push({ studentId, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('Error bulk promoting students:', err);
    res.status(500).json({ message: "Failed to bulk promote students" });
  }
});

// =====================================================
// FINANCIAL MANAGEMENT ROUTES
// =====================================================

// GET /api/finance/balance/:studentId - Get student balance
router.get("/finance/balance/:studentId", requirePermission("finance.view"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const studentId = req.params.studentId;

    const balance = await FeeBalanceService.getStudentBalanceWithFallback(schoolId, studentId);
    res.json({ balance });
  } catch (err) {
    console.error('Error fetching student balance:', err);
    res.status(500).json({ message: "Failed to fetch student balance" });
  }
});

// GET /api/finance/ledger - Get transaction ledger
router.get("/finance/ledger", requirePermission("ledger.view"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { studentId, academicYearId, termId, limit = 50, offset = 0 } = req.query;

    if (!studentId) {
      return res.status(400).json({ message: "studentId is required" });
    }

    const ledger = await FeeBalanceService.getTransactionLedger(schoolId, studentId, {
      academicYearId,
      termId,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(ledger);
  } catch (err) {
    console.error('Error fetching transaction ledger:', err);
    res.status(500).json({ message: "Failed to fetch transaction ledger" });
  }
});

// GET /api/finance/term-summary/:termId - Get term financial summary
router.get("/finance/term-summary/:termId", requirePermission("reports.financial"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const termId = req.params.termId;

    // Get term details
    const { data: term } = await supabase
      .from('terms')
      .select('*')
      .eq('term_id', termId)
      .eq('school_id', schoolId)
      .single();

    if (!term) {
      return res.status(404).json({ message: "Term not found" });
    }

    // Get financial summary
    const { data: summary, error } = await supabase
      .rpc('get_term_financial_summary', { term_id: termId });

    if (error) throw error;

    res.json({
      term,
      summary: summary || {}
    });
  } catch (err) {
    console.error('Error fetching term financial summary:', err);
    res.status(500).json({ message: "Failed to fetch term financial summary" });
  }
});

// =====================================================
// PROMOTION RULES ROUTES
// =====================================================

// GET /api/promotion/rules - Get promotion rules
router.get("/promotion/rules", requirePermission("promotion.view"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const rules = await PromotionService.getPromotionRules(schoolId);
    res.json(rules);
  } catch (err) {
    console.error('Error fetching promotion rules:', err);
    res.status(500).json({ message: "Failed to fetch promotion rules" });
  }
});

// POST /api/promotion/rules - Create promotion rule
router.post("/promotion/rules", requirePermission("promotion.approve"), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const ruleData = { ...req.body, school_id: schoolId };

    const { data, error } = await supabase
      .from('promotion_rules')
      .insert(ruleData)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error creating promotion rule:', err);
    res.status(500).json({ message: "Failed to create promotion rule" });
  }
});

// =====================================================
// PERMISSIONS ROUTES
// =====================================================

// GET /api/permissions/check/:permission - Check permission
router.get("/permissions/check/:permission", async (req, res) => {
  try {
    const { user_id } = req.user;
    const permission = req.params.permission;
    const resourceId = req.query.resourceId;

    const hasPermission = await PermissionService.checkPermission(user_id, permission, resourceId);
    res.json({ hasPermission });
  } catch (err) {
    console.error('Error checking permission:', err);
    res.status(500).json({ message: "Failed to check permission" });
  }
});

// GET /api/permissions/my - Get my permissions
router.get("/permissions/my", async (req, res) => {
  try {
    const { user_id } = req.user;
    const permissions = await PermissionService.getUserPermissions(user_id);
    res.json({ permissions });
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ message: "Failed to fetch permissions" });
  }
});

// =====================================================
// MIGRATION & INITIALIZATION ROUTES
// =====================================================

// POST /api/migration/initialize-academic - Initialize academic data
router.post("/migration/initialize-academic", requirePermission("academic.manage"), async (req, res) => {
  try {
    const { schoolId } = req.user;

    // Initialize academic years
    await AcademicYearService.initializeFromLegacy(schoolId);

    // Initialize terms
    await TermService.initializeFromLegacy(schoolId);

    // Initialize enrollments
    await StudentEnrollmentService.initializeFromLegacy(schoolId);

    res.json({ message: "Academic data initialized successfully" });
  } catch (err) {
    console.error('Error initializing academic data:', err);
    res.status(500).json({ message: "Failed to initialize academic data" });
  }
});

// GET /api/migration/status - Check migration status
router.get("/migration/status", requirePermission("academic.view"), async (req, res) => {
  try {
    const { schoolId } = req.user;

    const [
      { count: academicYears },
      { count: terms },
      { count: enrollments },
      { count: ledgerEntries }
    ] = await Promise.all([
      supabase.from('academic_years').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('terms').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('student_enrollments').select('*', { count: 'exact', head: true }),
      supabase.from('fee_balance_ledger').select('*', { count: 'exact', head: true }).eq('school_id', schoolId)
    ]);

    res.json({
      academicYears,
      terms,
      enrollments,
      ledgerEntries,
      migrationComplete: academicYears > 0 && terms > 0
    });
  } catch (err) {
    console.error('Error checking migration status:', err);
    res.status(500).json({ message: "Failed to check migration status" });
  }
});

export default router;