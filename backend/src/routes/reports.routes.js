import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { getExpenditureSummary } from "../services/expenditure.service.js";
import { LedgerService } from "../services/ledger.service.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin", "teacher", "finance", "director", "superadmin"));

async function getCarryForwardMap(schoolId, termName) {
  try {
    const { data: termRow, error: termErr } = await supabase
      .from('terms')
      .select('term_id')
      .eq('school_id', schoolId)
      .eq('term_name', termName)
      .limit(1)
      .maybeSingle();

    if (termErr || !termRow?.term_id) return new Map();

    const { data: ledgerRows, error: ledgerErr } = await supabase
      .from('fee_balance_ledger')
      .select('student_id, amount')
      .eq('school_id', schoolId)
      .eq('term_id', termRow.term_id)
      .eq('transaction_type', 'carry_forward');

    if (ledgerErr || !ledgerRows?.length) return new Map();

    const carryMap = new Map();
    ledgerRows.forEach((row) => {
      carryMap.set(row.student_id, (carryMap.get(row.student_id) || 0) + Number(row.amount || 0));
    });
    return carryMap;
  } catch {
    return new Map();
  }
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getTransportFeeLikeFeesPage(student) {
  const direction = student?.transport_direction ?? "none";
  if (!direction || direction === "none") return 0;
  return toNumber(student?.transport_base_fee);
}

function getLunchFeeLikeFeesPage(student) {
  const enabled = Boolean(student?.lunch_enabled);
  if (!enabled) return 0;
  const rate = toNumber(student?.lunch_daily_rate);
  const days = toNumber(student?.lunch_days || 66);
  return student?.lunch_billing_type === "termly" ? rate : rate * days;
}

function getBreakfastFeeLikeFeesPage(student) {
  const enabled = Boolean(student?.breakfast_enabled);
  if (!enabled) return 0;
  const rate = toNumber(student?.breakfast_daily_rate);
  const days = toNumber(student?.breakfast_days || 66);
  return student?.breakfast_billing_type === "termly" ? rate : rate * days;
}

function calculateReportBalanceLikeFeesPage(student, classFee, paidAmount) {
  const openingBalance = LedgerService.getOpeningBalanceImpact(student);
  const transportFee = getTransportFeeLikeFeesPage(student);
  const lunchFee = getLunchFeeLikeFeesPage(student);
  const breakfastFee = getBreakfastFeeLikeFeesPage(student);
  const extraCharges = transportFee + lunchFee + breakfastFee;
  // CRITICAL: Apply discount ONLY to base fee (classFee), then add back non-discounted components
  const expected = LedgerService.applyStudentDiscount(classFee, student, extraCharges, openingBalance);
  const rawBalance = expected - toNumber(paidAmount);

  return {
    openingBalance,
    transportFee,
    lunchFee,
    breakfastFee,
    currentTermCharge: classFee + transportFee + lunchFee + breakfastFee,
    expected,
    rawBalance,
    balance: Math.max(0, rawBalance),
    overpaymentAmount: rawBalance < 0 ? Math.abs(rawBalance) : 0,
  };
}


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

    // Calculate outstanding using current-term fees plus brought-forward debit/credit.
    let totalOutstanding = 0;
    let debugCount = 0;
    students?.forEach(student => {
      const classFee = feeMap[student.class_name] || 0;
      const paid = paymentMap[student.student_id] || 0;
      const balanceInfo = calculateReportBalanceLikeFeesPage(student, classFee, paid);
      const outstanding = balanceInfo.balance;
      totalOutstanding += outstanding;
      if (debugCount < 5 && outstanding > 10000) {
        console.log(`[DEBUG] Student ${student.student_id}: classFee=${classFee}, openingBalance=${balanceInfo.openingBalance}, transportFee=${balanceInfo.transportFee}, lunchFee=${balanceInfo.lunchFee}, breakfastFee=${balanceInfo.breakfastFee}, expected=${balanceInfo.expected}, paid=${paid}, outstanding=${outstanding}`);
        debugCount++;
      }
    });
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

    const { data: allStudents, error: stuErr } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, admission_number, class_name, parent_phone, status, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, lunch_billing_type, breakfast_enabled, breakfast_daily_rate, breakfast_days, breakfast_billing_type, discount_type, discount_value, discount_is_percentage')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active')
      .order('class_name', { ascending: true });
    if (stuErr) throw stuErr;

    const { data: feeStructures, error: feeErr } = await supabase
      .from('fee_structures')
      .select('class_name, tuition, activity, misc')
      .eq('school_id', schoolId)
      .eq('term', currentTerm)
      .eq('is_deleted', false);
    if (feeErr) throw feeErr;

    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('student_id, amount, payment_date, term')
      .eq('school_id', schoolId)
      .eq('status', 'paid')
      .eq('term', currentTerm)
      .eq('is_deleted', false);
    if (payErr) throw payErr;

    const feeMap = {};
    feeStructures?.forEach(fs => {
      const expected = Number(fs.tuition) + Number(fs.activity) + Number(fs.misc);
      feeMap[fs.class_name] = expected;
    });

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
      const classFee = feeMap[student.class_name] || 0;
      const paidAmount = paymentMap[student.student_id]?.total || 0;
      const balanceInfo = calculateReportBalanceLikeFeesPage(student, classFee, paidAmount);
      const balance = balanceInfo.balance;
      const lastPaymentDate = paymentMap[student.student_id]?.lastPaymentDate || null;

      if (balance > 0) {
        defaultersList.push({
          student_id: student.student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          admission_number: student.admission_number,
          class_name: student.class_name,
          parent_phone: student.parent_phone,
          expected_amount: balanceInfo.expected,
          current_term_charge: balanceInfo.currentTermCharge,
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
    const currentTerm = term || 'Term 2'; // Default to Term 2 if not specified
    
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
    
    // Build payment map per student for the already-filtered term
    const paymentMap = {};
    payments?.forEach(payment => {
      if (!paymentMap[payment.student_id]) {
        paymentMap[payment.student_id] = 0;
      }
      paymentMap[payment.student_id] += Number(payment.amount);
    });
    
    // Calculate per-class summary using current-term fees plus brought-forward debit/credit.
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
      
      const paid = paymentMap[student.student_id] || 0;
      const classFee = feeMap[student.class_name] || 0;
      const balanceInfo = calculateReportBalanceLikeFeesPage(student, classFee, paid);
      const outstanding = balanceInfo.balance;
      
      classSummary[cls].student_count += 1;
      classSummary[cls].total_expected += balanceInfo.expected;
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
        .select('subject, marks, total_marks')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (error) throw error;
      
      const subjectStats = {};
      results?.forEach(result => {
        if (!subjectStats[result.subject]) {
          subjectStats[result.subject] = { scores: [], entries: 0 };
        }
        const total = Number(result.total_marks) || 100;
        const percentage = total > 0 ? (Number(result.marks) / total) * 100 : 0;
        subjectStats[result.subject].scores.push(percentage);
        subjectStats[result.subject].entries++;
      });
      
      const distribution = Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        avg_score: stats.scores.length > 0 ? Number((stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length).toFixed(1)) : 0,
        highest: stats.scores.length > 0 ? Number(Math.max(...stats.scores).toFixed(1)) : 0,
        lowest: stats.scores.length > 0 ? Number(Math.min(...stats.scores).toFixed(1)) : 0,
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
