import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { getExpenditureSummary } from "../services/expenditure.service.js";
import { LedgerService } from "../services/ledger.service.js";
import { FeeBalanceService } from "../services/backend_services.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin", "teacher", "finance", "director", "superadmin"));


// ─── Summary dashboard stats ──────────────────────────────────────────────────
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query; // Allow term filtering via query param
    const currentTerm = term || 'Term 2'; // Default to Term 2 if not specified
    const expenditureSummary = await getExpenditureSummary(schoolId);
    
    // Get student counts by gender
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('student_id, gender, class_name, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, breakfast_enabled, breakfast_daily_rate, breakfast_days, discount_type, discount_value, discount_is_percentage')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
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
    const { data: paidPayments, error: paidErr } = await supabase
      .from('payments')
      .select('amount, payment_date, student_id, term')
      .eq('school_id', schoolId)
      .eq('status', 'paid')
      .eq('is_deleted', false);
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

    // Build fee structure map (check for duplicates)
    const feeMap = {};
    const duplicateClasses = new Set();
    feeStructures?.forEach(fs => {
      const expected = Number(fs.tuition) + Number(fs.activity) + Number(fs.misc);
      if (feeMap[fs.class_name]) {
        duplicateClasses.add(fs.class_name);
        console.warn(`[FEE STRUCTURE DUPLICATE] Class ${fs.class_name} has multiple fee structures. Using latest value.`);
      }
      feeMap[fs.class_name] = expected;
    });
    if (duplicateClasses.size > 0) {
      console.warn(`[FEE STRUCTURE DUPLICATES] Found duplicates for classes: ${Array.from(duplicateClasses).join(', ')}`);
    }
    console.log(`[FEE STRUCTURES] Loaded ${Object.keys(feeMap).length} unique class fees for term ${currentTerm}`);

    // Build payment map per student (filter by current term)
    const paymentMap = {};
    paidPayments?.forEach(payment => {
      // Only include payments for the current term
      if (payment.term === currentTerm) {
        if (!paymentMap[payment.student_id]) {
          paymentMap[payment.student_id] = 0;
        }
        paymentMap[payment.student_id] += Number(payment.amount);
      }
    });

    // Calculate total outstanding (use ledger as source-of-truth)
    let totalOutstanding = 0;
    try {
      // Use ledger-based balances for accuracy. This may issue one query per student.
      const balances = await Promise.all((students || []).map(s => FeeBalanceService.getStudentBalanceWithFallback(schoolId, s.student_id)));
      balances.forEach(b => { if (b > 0) totalOutstanding += Number(b); });
    } catch (e) {
      console.error('[REPORTS] Failed to compute ledger balances, falling back to legacy calculation', e);
      // Fallback to previous method when ledger read fails
      let debugCount = 0;
      students?.forEach(student => {
        const classFee = feeMap[student.class_name] || 0;
        const extraCharges = LedgerService.getStudentExtraCharges(student);
        const grossCurrentTerm = classFee + extraCharges;
        const currentTermExpected = LedgerService.applyStudentDiscount(grossCurrentTerm, student);
        const paid = paymentMap[student.student_id] || 0;
        const outstanding = Math.max(0, currentTermExpected - paid);
        totalOutstanding += outstanding;
        if (debugCount < 5 && outstanding > 10000) {
          console.log(`[DEBUG] Student ${student.student_id}: classFee=${classFee}, extraCharges=${extraCharges}, expected=${currentTermExpected}, paid=${paid}, outstanding=${outstanding}`);
          debugCount++;
        }
      });
    }
    console.log(`[DEBUG] Total outstanding: ${totalOutstanding}, Total students: ${students?.length}`);

    // Get pending plans count (if payment_plans table exists)
    let pendingPlans = 0;
    try {
      const { count, error: plansErr } = await supabase
        .from('payment_plans')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'pending')
        .eq('is_deleted', false);
      if (!plansErr) pendingPlans = count || 0;
    } catch {
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
      .eq('status', 'paid')
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
router.get("/fee-defaulters", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query; // Allow term filtering via query param
    const currentTerm = term || 'Term 2'; // Default to Term 2 if not specified
    
    // OLD: Basic defaulters with hardcoded 10,000 KSh expected amount
    // let students = null;
    // try {
    //   const { data } = await supabase.rpc('get_fee_defaulters', { p_school_id: schoolId });
    //   students = data;
    // } catch {
    //   students = null;
    // }
    
    // NEW: Enhanced defaulters with proper fee structure integration
    let defaulters = null;
    try {
      const { data } = await supabase.rpc('get_fee_defaulters_enhanced', {
        p_school_id: schoolId,
        p_term: currentTerm,
      });
      defaulters = data;
    } catch {
      defaulters = null;
    }
    
    // Fallback to manual calculation if RPC not available
    if (!defaulters) {
      // Get students with their classes
      const { data: allStudents, error: stuErr } = await supabase
        .from('students')
        .select('student_id, first_name, last_name, admission_number, class_name, parent_phone, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, breakfast_enabled, breakfast_daily_rate, breakfast_days, discount_type, discount_value, discount_is_percentage')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .order('class_name', { ascending: true });
      if (stuErr) throw stuErr;
      
      // Get fee structures for proper expected amounts (filter by term)
      const { data: feeStructures, error: feeErr } = await supabase
        .from('fee_structures')
        .select('class_name, tuition, activity, misc')
        .eq('school_id', schoolId)
        .eq('term', currentTerm)
        .eq('is_deleted', false);
      if (feeErr) throw feeErr;
      
      // Get paid payments (filter by term)
      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('student_id, amount, payment_date, term')
        .eq('school_id', schoolId)
        .eq('status', 'paid')
        .eq('term', currentTerm)
        .eq('is_deleted', false);
      if (payErr) throw payErr;
      
      // Build fee structure map
      const feeMap = {};
      feeStructures?.forEach(fs => {
        const expected = Number(fs.tuition) + Number(fs.activity) + Number(fs.misc);
        feeMap[fs.class_name] = expected;
      });
      
      // Build payment map per student
      const paymentMap = {};
      payments?.forEach(payment => {
        if (!paymentMap[payment.student_id]) {
          paymentMap[payment.student_id] = { total: 0, lastPaymentDate: null };
        }
        paymentMap[payment.student_id].total += Number(payment.amount);
        // Track last payment date
        if (!paymentMap[payment.student_id].lastPaymentDate || 
            payment.payment_date > paymentMap[payment.student_id].lastPaymentDate) {
          paymentMap[payment.student_id].lastPaymentDate = payment.payment_date;
        }
      });
      
      // Calculate defaulters using ledger balances (more accurate)
      const defaultersList = [];
      for (const student of (allStudents || [])) {
        try {
          // Ledger-first balance
          const ledgerBalance = await FeeBalanceService.getStudentBalanceWithFallback(schoolId, student.student_id);
          // Keep expected amount for context
          const classFee = feeMap[student.class_name] || 0;
          const grossCurrentTerm = classFee + LedgerService.getStudentExtraCharges(student);
          const currentTermExpected = LedgerService.applyStudentDiscount(grossCurrentTerm, student);
          const lastPaymentDate = paymentMap[student.student_id]?.lastPaymentDate || null;

          const balance = Math.max(0, Number(ledgerBalance) || 0);
          if (balance > 0) {
            defaultersList.push({
              student_id: student.student_id,
              student_name: `${student.first_name} ${student.last_name}`,
              admission_number: student.admission_number,
              class_name: student.class_name,
              parent_phone: student.parent_phone,
              expected_amount: currentTermExpected,
              paid_amount: paymentMap[student.student_id]?.total || 0,
              balance: balance,
              last_payment_date: lastPaymentDate,
              balance_percentage: currentTermExpected > 0 ? (balance / currentTermExpected) * 100 : 0
            });
          }
        } catch (e) {
          console.error('[REPORTS] Failed to get balance for student', student.student_id, e);
        }
      }

      defaultersList.sort((a,b) => b.balance - a.balance);
      return res.json(defaultersList);
    }
    
    res.json(defaulters || []);
  } catch (err) { next(err); }
});

// ─── Class-wise fee summary ────────────────────────────────────────────────
router.get("/class-fee-summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query; // Allow term filtering via query param
    const currentTerm = term || 'Term 2'; // Default to Term 2 if not specified
    
    // Get all students
    const { data: allStudents, error: stuErr } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, class_name, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, breakfast_enabled, breakfast_daily_rate, breakfast_days, discount_type, discount_value, discount_is_percentage')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
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
      .eq('status', 'paid')
      .eq('term', currentTerm)
      .eq('is_deleted', false);
    if (payErr) throw payErr;
    
    // Build fee structure map
    const feeMap = {};
    feeStructures?.forEach(fs => {
      const expected = Number(fs.tuition) + Number(fs.activity) + Number(fs.misc);
      feeMap[fs.class_name] = expected;
    });
    
    // Build payment map per student (filter by current term for balance calculation)
    const paymentMap = {};
    paidPayments?.forEach(payment => {
      // Only include payments for the current term
      if (payment.term === currentTerm) {
        if (!paymentMap[payment.student_id]) {
          paymentMap[payment.student_id] = 0;
        }
        paymentMap[payment.student_id] += Number(payment.amount);
      }
    });
    
    // Calculate per-class summary (current term only)
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
      
      const classFee = feeMap[student.class_name] || 0;
      // Current term expected fees only
      const grossCurrentTerm = classFee + LedgerService.getStudentExtraCharges(student);
      const currentTermExpected = LedgerService.applyStudentDiscount(grossCurrentTerm, student);
      const paid = paymentMap[student.student_id] || 0;
      // Outstanding = current term expected - current term paid
      const outstanding = Math.max(0, currentTermExpected - paid);
      
      classSummary[cls].student_count += 1;
      classSummary[cls].total_expected += currentTermExpected;
      classSummary[cls].total_paid += paid;
      classSummary[cls].total_outstanding += outstanding;
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
    
    let grades = null;
    try {
      const { data } = await supabase.rpc('get_grade_distribution', { p_school_id: schoolId });
      grades = data;
    } catch {
      grades = null;
    }
    
    // Fallback to simpler query if RPC not available
    if (!grades) {
      const { data: results, error } = await supabase
        .from('results')
        .select('subject, marks')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (error) throw error;
      
      const subjectStats = {};
      results?.forEach(result => {
        if (!subjectStats[result.subject]) {
          subjectStats[result.subject] = { scores: [], entries: 0 };
        }
        subjectStats[result.subject].scores.push(Number(result.marks));
        subjectStats[result.subject].entries++;
      });
      
      const distribution = Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        avgScore: stats.scores.length > 0 ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) : 0,
        highest: stats.scores.length > 0 ? Math.max(...stats.scores) : 0,
        lowest: stats.scores.length > 0 ? Math.min(...stats.scores) : 0,
        entries: stats.entries
      }));
      
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
      .eq('status', 'paid')
      .eq('is_deleted', false);
    if (payErr) throw payErr;
    
    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    res.json({ student, grades, attendance: attendanceStats, totalPaid });
  } catch (err) { next(err); }
});

export default router;
