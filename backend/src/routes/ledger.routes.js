import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { logActivity } from "../helpers/activity.logger.js";
import LedgerService from "../services/ledger.service.js";
import { calculateStudentFeeBalance } from "../services/feeBalanceCalculator.js";

const router = Router();
router.use(authRequired);

// ─── GET /api/ledger/student/:studentId ──────────────────────────────────────
router.get("/student/:studentId", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const ledger = await LedgerService.getStudentLedger(schoolId, studentId, limit, offset);
    const balance = await LedgerService.getStudentBalance(schoolId, studentId);

    res.json({ ledger, balance });
  } catch (err) { next(err); }
});

// ─── GET /api/ledger/student/:studentId/statement ────────────────────────────
router.get("/student/:studentId/statement", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const { term } = req.query;

    const statement = await LedgerService.getFeeStatement(schoolId, studentId, term);
    res.json(statement);
  } catch (err) { next(err); }
});

// ─── GET /api/ledger/all/balances ────────────────────────────────────────────
router.get("/all/balances", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query;

    // Fetch all students
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, class_name')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');
    if (stuErr) throw stuErr;

    const { data: feeStructures } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    let query = supabase
      .from('payments')
      .select('student_id, amount, status')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .in('status', ['paid', 'completed', 'success']);
    if (term) query = query.eq('term', term);
    const { data: payments } = await query;

    const studentBalances = (students || []).map(s => {
      const balanceInfo = calculateStudentFeeBalance({ student: s, feeStructures: feeStructures || [], payments: payments || [] });
      return {
        student_id: s.student_id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        class: s.class_name,
        expected: balanceInfo.expected,
        paid: balanceInfo.paid,
        balance: balanceInfo.balance,
        isOverpaid: balanceInfo.isOverpaid,
      };
    });

    const totalExpected = studentBalances.reduce((s, b) => s + b.expected, 0);
    const totalPaid = studentBalances.reduce((s, b) => s + b.paid, 0);
    const totalOutstanding = studentBalances.reduce((s, b) => s + b.balance, 0);
    const defaulters = studentBalances.filter(b => b.balance > 0);
    const cleared = studentBalances.filter(b => b.balance === 0 && !b.isOverpaid);
    const overpaid = studentBalances.filter(b => b.isOverpaid);

    res.json({
      summary: { totalExpected, totalPaid, totalOutstanding, totalStudents: studentBalances.length, defaulters: defaulters.length, cleared: cleared.length, overpaid: overpaid.length },
      students: studentBalances,
      defaulters,
      cleared,
      overpaid,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/ledger/reconcile ──────────────────────────────────────────────
router.post("/reconcile",
  requireRoles("admin", "director", "superadmin"),
  async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;

      const result = await LedgerService.reconcileLedger(schoolId, userId);

      await logActivity(req, { action: "payment.update", entity: "ledger", entityId: null, description: `Ledger reconciliation: ${result.fixed} of ${result.processed} students fixed, ${result.errors.length} errors` });

      res.json({
        message: `Reconciliation complete. ${result.fixed} of ${result.processed} students updated.`,
        summary: {
          totalStudents: result.processed,
          studentsFixed: result.fixed,
          errors: result.errors.length,
        },
        errors: result.errors.slice(0, 10),
      });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/ledger/reset-opening-balances ─────────────────────────────────
// ONE-TIME recovery: recomputes students.opening_balance from raw payment data.
// This undoes corruption caused by the UUID bug that wrote inflated values.
router.post("/reset-opening-balances",
  requireRoles("admin", "director", "superadmin"),
  async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;

      const { data: students } = await supabase
        .from('students')
        .select('student_id, first_name, last_name, class_name, opening_balance, opening_balance_type')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);

      if (!students?.length) return res.json({ message: 'No students found', fixed: 0 });

      const { data: feeStructures } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);

      const { data: allPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .in('status', ['paid', 'completed', 'success']);

      let fixed = 0;
      let errors = [];
      for (const student of students) {
        try {
          // Compute correct balance with opening_balance=0 (pure formula from raw data)
          const correctFormula = calculateStudentFeeBalance({
            student: { ...student, opening_balance: 0, opening_balance_type: 'owing' },
            feeStructures: feeStructures || [],
            payments: allPayments || [],
          });

          const correctBalance = correctFormula.balance;
          const correctType = correctFormula.isOverpaid ? 'credit' : 'owing';

          // Only update if current stored value differs
          const currentBalance = Number(student.opening_balance) || 0;
          const needsUpdate = currentBalance !== correctBalance ||
            (student.opening_balance_type || 'owing') !== correctType;

          if (needsUpdate) {
            await supabase.from('students')
              .update({
                opening_balance: correctBalance,
                opening_balance_type: correctType,
                updated_at: new Date(),
              })
              .eq('student_id', student.student_id);
            fixed++;
          }
        } catch (err) {
          errors.push({ studentId: student.student_id, error: err.message });
        }
      }

      await logActivity(req, { action: "payment.update", entity: "ledger", entityId: null, description: `Opening balance reset: ${fixed} of ${students.length} students updated, ${errors.length} errors` });

      res.json({
        message: `Opening balances recomputed. ${fixed} of ${students.length} students updated.`,
        summary: { totalStudents: students.length, studentsFixed: fixed, errors: errors.length },
        errors: errors.slice(0, 10),
      });
    } catch (err) { next(err); }
  }
);

export default router;
