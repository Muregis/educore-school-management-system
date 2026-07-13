import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { getExpenditureSummary } from "../services/expenditure.service.js";
import { calculateStudentFeeBalance } from "../services/feeBalanceCalculator.js";
import { isMissingTableError } from "../utils/missingTableError.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin", "teacher", "finance", "director", "superadmin"));

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// All per-student fee balances are computed through `calculateStudentFeeBalance`
// (the single source of truth in services/feeBalanceCalculator.js) so that the
// school total, defaulters, class summary and the Fees page can never diverge.


// ─── Summary dashboard stats ──────────────────────────────────────────────────
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query; // Allow term filtering via query param
    const currentTerm = term; // No default - require term parameter
    const expenditureSummary = await getExpenditureSummary(schoolId);
    
    // Get student counts by gender
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('student_id, gender, class_name, status, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, lunch_billing_type, breakfast_enabled, breakfast_daily_rate, breakfast_days, breakfast_billing_type, discount_type, discount_value, discount_is_percentage')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');
    if (stuErr) throw stuErr;

    const boys = students?.filter(s => s.gender === 'male').length || 0;
    const girls = students?.filter(s => s.gender === 'female').length || 0;
    const totalStudents = students?.length || 0;

    const { count: totalTeachers, error: teaErr } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (teaErr) throw teaErr;

    // Get all paid payments for total collection (filter by term for balance calculation)
    const payQuery = supabase
      .from('payments')
      .select('amount, payment_date, student_id, term')
      .eq('school_id', schoolId)
      .in('status', ['paid', 'completed', 'success'])
      .eq('is_deleted', false);
    if (currentTerm) payQuery.eq('term', currentTerm);
    const { data: paidPayments, error: paidErr } = await payQuery;
    if (paidErr) throw paidErr;
    const totalCollected = paidPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Get today's collection
    const today = new Date().toISOString().split('T')[0];
    const todayCollection = paidPayments
      ?.filter(p => p.payment_date === today)
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const { data: pendingPayments, error: pendErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .eq('is_deleted', false);
    if (pendErr) throw pendErr;
    const totalPending = pendingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Calculate outstanding balance (expected fees - paid)
    const { data: feeStructures, error: feeErr } = await supabase
      .from('fee_structures')
      .select('class_name, tuition, activity, misc')
      .eq('school_id', schoolId)
      .eq('term', currentTerm)
      .eq('is_deleted', false);
    if (feeErr) throw feeErr;

    // Calculate outstanding using the canonical fee-balance formula
    // (single source of truth shared with the Fees page, Dashboard, etc.).
    let totalOutstanding = 0;
    students?.forEach(student => {
      const balanceInfo = calculateStudentFeeBalance({
        student,
        feeStructures,
        payments: paidPayments || [],
      });
      totalOutstanding += balanceInfo.balance;
    });

    // Get pending plans count (if payment_plans table exists)
    let pendingPlans = 0;
    try {
      const { count, error: plansErr } = await supabase
        .from('payment_plans')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'pending')
        .eq('is_deleted', false);
      if (!plansErr && count != null) pendingPlans = count;
    } catch (err) {
      if (!isMissingTableError(err)) {
        console.warn('[reports] payment_plans query failed:', err.message);
      }
      pendingPlans = 0;
    }

    const { count: presentCount, error: presErr } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('attendance_date', today)
      .eq('status', 'present')
      .eq('is_deleted', false);
    if (presErr) throw presErr;

    const { count: absentCount, error: absErr } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('attendance_date', today)
      .eq('status', 'absent')
      .eq('is_deleted', false);
    if (absErr) throw absErr;

    const totalExpenses = expenditureSummary?.totals?.total || 0;
    const payrollExpenses = expenditureSummary?.totals?.payroll || 0;
    const manualExpenses = expenditureSummary?.totals?.manual || 0;

    res.json({
      boys,
      girls,
      totalStudents,
      totalTeachers: totalTeachers || 0,
      totalCollected,
      todayCollection,
      totalPending,
      totalOutstanding,
      pendingPlans,
      totalExpenses,
      payrollExpenses,
      manualExpenses,
      netCashflow: totalCollected - totalExpenses,
      presentToday: presentCount || 0,
      absentToday: absentCount || 0
    });
  } catch (err) { next(err); }
});

router.get("/expenditure-summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const summary = await getExpenditureSummary(schoolId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// ─── Monthly fee collection ───────────────────────────────────────────────────
router.get("/monthly-fee-collection", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const { data: payments, error } = await supabase
      .from('payments')
      .select('payment_date, amount')
      .eq('school_id', schoolId)
      .in('status', ['paid', 'completed', 'success'])
      .eq('is_deleted', false)
      .order('payment_date', { ascending: false });
    if (error) throw error;

    // Group by month
    const monthlyData = {};
    payments?.forEach(payment => {
      const month = payment.payment_date.substring(0, 7); // YYYY-MM format
      if (!monthlyData[month]) {
        monthlyData[month] = { collected: 0, transactions: 0 };
      }
      monthlyData[month].collected += Number(payment.amount);
      monthlyData[month].transactions += 1;
    });

    // Convert to array and sort by month (last 12 months)
    const result = Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);

    res.json(result);
  } catch (err) { next(err); }
});

// ─── Attendance rate by class ─────────────────────────────────────────────────
router.get("/attendance-rate", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    let attendance = null;
    try {
      const { data } = await supabase.rpc('get_attendance_rate_by_class', { p_school_id: schoolId });
      attendance = data;
    } catch {
      attendance = null;
    }
    
    // Fallback to simpler query if RPC not available
    if (!attendance) {
      const { data: students, error: stuErr } = await supabase
        .from('students')
        .select('student_id, class_name')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (stuErr) throw stuErr;
      
      const classStats = {};
      students?.forEach(student => {
        if (!classStats[student.class_name]) {
          classStats[student.class_name] = { total: 0, present: 0 };
        }
        classStats[student.class_name].total++;
      });
      
      const { data: attendanceRecords, error: attErr } = await supabase
        .from('attendance')
        .select('status, student_id')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (attErr) throw attErr;
      
      attendanceRecords?.forEach(record => {
        const student = students?.find(s => s.student_id === record.student_id);
        if (student && record.status === 'present' && classStats[student.class_name]) {
          classStats[student.class_name].present++;
        }
      });
      
      const result = Object.entries(classStats).map(([class_name, stats]) => ({
        class_name,
        total: stats.total,
        present: stats.present,
        rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
      }));
      
      return res.json(result);
    }
    
    res.json(attendance || []);
  } catch (err) { next(err); }
});

// ─── Fee defaulters ───────────────────────────────────────────────────
async function resolveCurrentTermName(schoolId) {
  try {
    const { data: current, error } = await supabase
      .from('terms')
      .select('term_name')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!error && current?.term_name) return current.term_name;

    const { data: anyTerm } = await supabase
      .from('terms')
      .select('term_name')
      .eq('school_id', schoolId)
      .limit(1)
      .maybeSingle();
    return anyTerm?.term_name || null;
  } catch {
    return null;
  }
}

router.get("/fee-defaulters", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query; // Allow term filtering via query param
    // Fall back to the school's active term so balances reflect real payments
    const currentTerm = term || await resolveCurrentTermName(schoolId);

    const { data: allStudents, error: stuErr } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, admission_number, class_name, parent_phone, status, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, lunch_billing_type, breakfast_enabled, breakfast_daily_rate, breakfast_days, breakfast_billing_type, discount_type, discount_value, discount_is_percentage')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active')
      .order('class_name', { ascending: true });
    if (stuErr) throw stuErr;

    const feeQuery = supabase
      .from('fee_structures')
      .select('class_name, tuition, activity, misc')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (currentTerm) feeQuery.eq('term', currentTerm);
    const { data: feeStructures, error: feeErr } = await feeQuery;
    if (feeErr) throw feeErr;

    const payQuery = supabase
      .from('payments')
      .select('student_id, amount, payment_date, term')
      .eq('school_id', schoolId)
      .in('status', ['paid', 'completed', 'success'])
      .eq('is_deleted', false);
    if (currentTerm) payQuery.eq('term', currentTerm);
    const { data: payments, error: payErr } = await payQuery;
    if (payErr) throw payErr;

    const paymentMap = {};
    payments?.forEach(payment => {
      if (!paymentMap[payment.student_id]) {
        paymentMap[payment.student_id] = { total: 0, lastPaymentDate: null };
      }
      paymentMap[payment.student_id].total += Number(payment.amount);
      if (!paymentMap[payment.student_id].lastPaymentDate ||
          payment.payment_date > paymentMap[payment.student_id].lastPaymentDate) {
        paymentMap[payment.student_id].lastPaymentDate = payment.payment_date;
      }
    });

    const defaultersList = [];
    for (const student of (allStudents || [])) {
      // Canonical balance calculation (single source of truth shared with the
      // Fees page / Dashboard). feeMap/classFee is intentionally ignored here.
      const balanceInfo = calculateStudentFeeBalance({
        student,
        feeStructures,
        payments,
      });

      const balance = balanceInfo.balance;
      const paidAmount = balanceInfo.paid;
      const lastPaymentDate = paymentMap[student.student_id]?.lastPaymentDate || null;

      if (balance > 0) {
        defaultersList.push({
          student_id: student.student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          admission_number: student.admission_number,
          class_name: student.class_name,
          parent_phone: student.parent_phone,
          expected_amount: balanceInfo.expected,
          current_term_charge: balanceInfo.baseFee + balanceInfo.transportFee + balanceInfo.lunchFee + balanceInfo.breakfastFee,
          paid_amount: paidAmount,
          balance,
          last_payment_date: lastPaymentDate,
          balance_percentage: balanceInfo.expected > 0 ? (balance / balanceInfo.expected) * 100 : 0,
          carry_forward_amount: balanceInfo.openingBalance
        });
      }
    }

    defaultersList.sort((a, b) => b.balance - a.balance);
    res.json(defaultersList);
  } catch (err) { next(err); }
});

// ─── Class-wise fee summary ────────────────────────────────────────────────
router.get("/class-fee-summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query; // Allow term filtering via query param
    const currentTerm = term; // No default - require term parameter
    
    // Get all students
    const { data: allStudents, error: stuErr } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, class_name, status, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, lunch_billing_type, breakfast_enabled, breakfast_daily_rate, breakfast_days, breakfast_billing_type, discount_type, discount_value, discount_is_percentage')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');
    if (stuErr) throw stuErr;
    
    // Get fee structures (filter by term)
    const { data: feeStructures, error: feeErr } = await supabase
      .from('fee_structures')
      .select('class_name, tuition, activity, misc')
      .eq('school_id', schoolId)
      .eq('term', currentTerm)
      .eq('is_deleted', false);
    if (feeErr) throw feeErr;
    
    // Get all paid payments (filter by term)
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('student_id, amount')
      .eq('school_id', schoolId)
      .in('status', ['paid', 'completed', 'success'])
      .eq('term', currentTerm)
      .eq('is_deleted', false);
    if (payErr) throw payErr;

    // Calculate per-class summary using the canonical fee-balance formula
    // (single source of truth shared with the Fees page / Dashboard).
    const classSummary = {};
    allStudents?.forEach(student => {
      const cls = student.class_name;
      if (!classSummary[cls]) {
        classSummary[cls] = {
          class_name: cls,
          student_count: 0,
          total_expected: 0,
          total_paid: 0,
          total_outstanding: 0
        };
      }

      const balanceInfo = calculateStudentFeeBalance({
        student,
        feeStructures,
        payments,
      });

      classSummary[cls].student_count += 1;
      classSummary[cls].total_expected += balanceInfo.expected;
      classSummary[cls].total_paid += balanceInfo.paid;
      classSummary[cls].total_outstanding += balanceInfo.balance;
    });
    
    // Convert to array and sort by class name
    const result = Object.values(classSummary).sort((a, b) => a.class_name.localeCompare(b.class_name));
    
    res.json(result);
  } catch (err) { next(err); }
});

// ─── Grade distribution by subject ───────────────────────────────────────────
router.get("/grade-distribution", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { class_name } = req.query;

    let grades = null;
    // Only use RPC if no class filter is provided (RPC doesn't support class filtering)
    if (!class_name) {
      try {
        const { data } = await supabase.rpc('get_grade_distribution', { p_school_id: schoolId });
        grades = data;
      } catch {
        grades = null;
      }
    }

    // Fallback to simpler query if RPC not available or class filter is provided
    if (!grades) {
      let query = supabase
        .from('results')
        .select('subject, marks, total_marks, class_id, student_id, term, exam_type')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);

      const { data: results, error } = await query;
      if (error) throw error;

      const classIds = [...new Set((results || []).map(r => r.class_id).filter(Boolean))];
      const studentIds = [...new Set((results || []).map(r => r.student_id).filter(Boolean))];
      let classById = new Map();
      let studentById = new Map();

      const [{ data: classes }, { data: students }] = await Promise.all([
        classIds.length
          ? supabase.from('classes').select('class_id, class_name').in('class_id', classIds)
          : Promise.resolve({ data: [] }),
        studentIds.length
          ? supabase.from('students').select('student_id, class_name').eq('school_id', schoolId).eq('is_deleted', false).in('student_id', studentIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (classes) classById = new Map(classes.map(c => [c.class_id, c.class_name]));
      if (students) studentById = new Map(students.map(s => [s.student_id, s]));

      // Calculate grade distribution by class and subject
      const classSubjectStats = {};
      results?.forEach(result => {
        const className = classById.get(result.class_id) || studentById.get(result.student_id)?.class_name || 'All Classes';
        if (class_name && className !== class_name) return;
        const examType = result.exam_type || 'All Exams';
        const key = `${className}|${result.subject}|${examType}`;
        
        if (!classSubjectStats[key]) {
          classSubjectStats[key] = {
            class_name: className,
            subject: result.subject,
            exam_type: examType,
            scores: [],
            entries: 0,
            terms: new Set()
          };
        }
        
        const total = Number(result.total_marks) || 100;
        const percentage = total > 0 ? (Number(result.marks) / total) * 100 : 0;
        classSubjectStats[key].scores.push(percentage);
        classSubjectStats[key].entries++;
        if (result.term) classSubjectStats[key].terms.add(result.term);
      });

      const distribution = Object.values(classSubjectStats).map(stats => {
        const scores = stats.scores;
        const avg_score = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
        const highest = scores.length > 0 ? Number(Math.max(...scores).toFixed(1)) : 0;
        const lowest = scores.length > 0 ? Number(Math.min(...scores).toFixed(1)) : 0;
        
        // Calculate grade counts
        const gradeCounts = { EE: 0, ME: 0, AE: 0, BE: 0 };
        scores.forEach(score => {
          if (score >= 80) gradeCounts.EE++;
          else if (score >= 60) gradeCounts.ME++;
          else if (score >= 40) gradeCounts.AE++;
          else gradeCounts.BE++;
        });

        return {
          class_name: stats.class_name,
          subject: stats.subject,
          exam_type: stats.exam_type,
          avg_score,
          highest,
          lowest,
          entries: stats.entries,
          grade_counts: gradeCounts,
          terms: Array.from(stats.terms)
        };
      });

      return res.json(distribution);
    }
    
    res.json(grades || []);
  } catch (err) { next(err); }
});

// ─── Student report card ──────────────────────────────────────────────
router.get("/student/:studentId", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;

    const { data: student, error: stuErr } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, admission_number, class_name, gender')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();
    if (stuErr) throw stuErr;
    if (!student) return res.status(404).json({ message: "Student not found" });

    const { data: grades, error: gradeErr } = await supabase
      .from('results')
      .select('subject, term, marks, total_marks, grade, teacher_comment')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('term', { ascending: true })
      .order('subject', { ascending: true });
    if (gradeErr) throw gradeErr;

    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (attErr) throw attErr;
    
    const attendanceStats = {};
    attendance?.forEach(record => {
      if (!attendanceStats[record.status]) {
        attendanceStats[record.status] = 0;
      }
      attendanceStats[record.status]++;
    });

    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .in('status', ['paid', 'completed', 'success'])
      .eq('is_deleted', false);
    if (payErr) throw payErr;
    
    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    res.json({ student, grades, attendance: attendanceStats, totalPaid });
  } catch (err) { next(err); }
});

export default router;
