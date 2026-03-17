import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { LedgerService } from "../services/ledger.service.js";
import { supabase } from "../config/supabaseClient.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";

const router = Router();
router.use(authRequired);

// ─── GET /api/ledger/student/:studentId ───────────────────────────────────────
router.get("/student/:studentId", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify student belongs to school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, first_name, last_name')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const ledger = await LedgerService.getStudentLedger(schoolId, studentId, parseInt(limit), parseInt(offset));
    const balance = await LedgerService.getStudentBalance(schoolId, studentId);

    res.json({
      student: {
        studentId: student.student_id,
        name: `${student.first_name} ${student.last_name}`
      },
      balance,
      transactions: ledger
    });

  } catch (error) {
    next(error);
  }
});

// ─── GET /api/ledger/student/:studentId/statement ───────────────────────────────
router.get("/student/:studentId/statement", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const { term } = req.query;

    // Verify student belongs to school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, first_name, last_name')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const statement = await LedgerService.getFeeStatement(schoolId, studentId, term);

    res.json(statement);

  } catch (error) {
    next(error);
  }
});

// ─── POST /api/ledger/assess-fees ─────────────────────────────────────────────
router.post("/assess-fees", 
  requireRoles("admin", "finance"), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { classId, feeStructureId, term, academicYear } = req.body;

      if (!classId || !feeStructureId || !term || !academicYear) {
        return res.status(400).json({ 
          message: "classId, feeStructureId, term, and academicYear are required" 
        });
      }

      // Verify class belongs to school
    const { data: cls, error: classError } = await supabase
      .from('classes')
      .select('class_id, class_name')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (classError || !cls) {
      return res.status(404).json({ message: "Class not found" });
    }

      const results = await LedgerService.assessFeesForClass(
        schoolId, classId, feeStructureId, term, academicYear
      );

      res.json({
        message: "Fees assessed successfully",
        className: cls.class_name,
        term,
        academicYear,
        assessments: results.length
      });

    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/ledger/balances ─────────────────────────────────────────────────
router.get("/balances", 
  requireRoles("admin", "finance", "teacher"), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { classId, status } = req.query;

      // Get all students for this school
      let studentQuery = supabase
        .from('students')
        .select('student_id, admission_number, first_name, last_name, class_name')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);

      if (classId) {
        studentQuery = studentQuery.eq('class_id', classId);
      }

      const { data: students, error: studentError } = await studentQuery.order('class_name').order('first_name');
      if (studentError) throw studentError;

      // Get latest ledger entries for each student
      const { data: ledgerEntries, error: ledgerError } = await supabase
        .from('student_ledger')
        .select('student_id, balance_after, created_at')
        .eq('school_id', schoolId)
        .order('ledger_id', { ascending: false });

      if (ledgerError) throw ledgerError;

      // Map latest balance for each student
      const latestBalanceMap = new Map();
      for (const entry of ledgerEntries || []) {
        if (!latestBalanceMap.has(entry.student_id)) {
          latestBalanceMap.set(entry.student_id, entry);
        }
      }

      // Build student list with balances
      let studentsWithBalance = (students || []).map(s => ({
        ...s,
        balance: latestBalanceMap.get(s.student_id)?.balance_after || 0,
        last_transaction_date: latestBalanceMap.get(s.student_id)?.created_at || null
      }));

      // Filter by balance status if requested
      let filteredStudents = studentsWithBalance;
      if (status === 'owing') {
        filteredStudents = studentsWithBalance.filter(s => s.balance > 0);
      } else if (status === 'paid') {
        filteredStudents = studentsWithBalance.filter(s => s.balance <= 0);
      }

      // Calculate summary
      const summary = {
        totalStudents: filteredStudents.length,
        totalOwing: filteredStudents.filter(s => s.balance > 0).length,
        totalPaid: filteredStudents.filter(s => s.balance <= 0).length,
        totalBalance: filteredStudents.reduce((sum, s) => sum + Number(s.balance), 0)
      };

      res.json({
        summary,
        students: filteredStudents
      });

    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/ledger/adjustment ───────────────────────────────────────────────
router.post("/adjustment", 
  requireRoles("admin", "finance"), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { studentId, amount, description, adjustmentType = 'manual' } = req.body;

      if (!studentId || !amount || !description) {
        return res.status(400).json({ 
          message: "studentId, amount, and description are required" 
        });
      }

      // Verify student belongs to school
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('student_id, first_name, last_name')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .single();

      if (studentError || !student) {
        return res.status(404).json({ message: "Student not found" });
      }

      try {
        // Get current balance
        const { data: latestLedger, error: balanceError } = await supabase
          .from('student_ledger')
          .select('balance_after')
          .eq('student_id', studentId)
          .eq('school_id', schoolId)
          .order('ledger_id', { ascending: false })
          .limit(1)
          .single();

        if (balanceError && balanceError.code !== 'PGRST116') throw balanceError; // PGRST116 = no rows

        const previousBalance = latestLedger?.balance_after || 0;
        const newBalance = previousBalance + Number(amount);

        // Insert adjustment entry
        const { data: inserted, error: insertError } = await supabase
          .from('student_ledger')
          .insert({
            school_id: schoolId,
            student_id: studentId,
            transaction_type: 'adjustment',
            amount: amount,
            balance_after: newBalance,
            reference_type: 'adjustment',
            reference_id: null,
            description: description
          })
          .select('ledger_id')
          .single();

        if (insertError) throw insertError;

        // Log adjustment for audit
        await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_UPDATE, {
          entityId: inserted.ledger_id,
          entityType: 'ledger_adjustment',
          description: `Ledger adjustment for student ${studentId}: ${amount} (${description})`,
          newValues: { studentId, amount, previousBalance, newBalance, description }
        });

        res.json({
          message: "Adjustment recorded successfully",
          adjustmentId: inserted.ledger_id,
          previousBalance,
          newBalance,
          amount
        });

      } catch (error) {
        throw error;
      }

    } catch (error) {
      next(error);
    }
  }
);

export default router;
