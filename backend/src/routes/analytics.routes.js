import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;

    // Individual counts using Supabase
    const { count: totalStudents, error: stuErr } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');
    if (stuErr) throw stuErr;

    const { count: totalTeachers, error: teaErr } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');
    if (teaErr) throw teaErr;

    const { count: portalUsers, error: userErr } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .in('role', ['parent', 'student'])
      .eq('is_deleted', false);
    if (userErr) throw userErr;

    const { data: paidData, error: paidErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('status', 'paid')
      .eq('is_deleted', false);
    if (paidErr) throw paidErr;
    const totalCollected = paidData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const { data: pendingData, error: pendErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .eq('is_deleted', false);
    if (pendErr) throw pendErr;
    const totalPending = pendingData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const { count: pendingAdmissions, error: admErr } = await supabase
      .from('admissions')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .eq('is_deleted', false);
    if (admErr) throw admErr;

    const counts = {
      totalStudents: totalStudents || 0,
      totalTeachers: totalTeachers || 0,
      portalUsers: portalUsers || 0,
      totalCollected,
      totalPending,
      pendingAdmissions: pendingAdmissions || 0
    };

    // Monthly collections - last 6 months (manual grouping)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('payment_date, amount')
      .eq('school_id', schoolId)
      .eq('status', 'paid')
      .eq('is_deleted', false)
      .gte('payment_date', sixMonthsAgo.toISOString().split('T')[0]);
    if (payErr) throw payErr;

    const monthlyData = {};
    payments?.forEach(p => {
      const date = new Date(p.payment_date);
      const key = `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, m, y, total: 0 };
      }
      monthlyData[key].total += Number(p.amount);
    });
    const monthly = Object.values(monthlyData).sort((a, b) => a.y - b.y || a.m - b.m);

    // Attendance this month
    const thisMonthStart = new Date().toISOString().slice(0, 7) + '-01';
    const { data: attendanceData, error: attErr } = await supabase
      .from('attendance')
      .select('status')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .gte('attendance_date', thisMonthStart);
    if (attErr) throw attErr;

    const attendanceStats = {};
    attendanceData?.forEach(r => {
      attendanceStats[r.status] = (attendanceStats[r.status] || 0) + 1;
    });
    const attendance = Object.entries(attendanceStats).map(([status, count]) => ({ status, count }));

    // Students per class (with gender breakdown)
    const { data: studentsByClass, error: classErr } = await supabase
      .from('students')
      .select('class_name, gender')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');
    if (classErr) throw classErr;

    const classCounts = {};
    studentsByClass?.forEach(s => {
      if (s.class_name) {
        if (!classCounts[s.class_name]) {
          classCounts[s.class_name] = { total: 0, boys: 0, girls: 0 };
        }
        classCounts[s.class_name].total++;
        if (s.gender === 'male') classCounts[s.class_name].boys++;
        else if (s.gender === 'female') classCounts[s.class_name].girls++;
      }
    });
    const byClass = Object.entries(classCounts).map(([class_name, data]) => ({ 
      class_name, 
      total: Number(data.total),
      boys: Number(data.boys),
      girls: Number(data.girls)
    })).sort((a, b) => String(a.class_name || "").localeCompare(String(b.class_name || "")));

    // Grade distribution
    const { data: gradesData, error: gradeErr } = await supabase
      .from('results')
      .select('grade')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (gradeErr) throw gradeErr;

    const gradeCounts = {};
    gradesData?.forEach(r => {
      if (r.grade) {
        gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
      }
    });
    const grades = Object.entries(gradeCounts).map(([grade, count]) => ({ grade, count: Number(count) })).sort((a, b) => String(a.grade || "").localeCompare(String(b.grade || "")));

    // Recent payments with student join
    const { data: recentPaymentsData, error: recentErr } = await supabase
      .from('payments')
      .select('amount, payment_date, payment_method, paid_by, students(first_name, last_name, class_name)')
      .eq('school_id', schoolId)
      .eq('status', 'paid')
      .eq('is_deleted', false)
      .order('payment_date', { ascending: false })
      .limit(8);
    if (recentErr) throw recentErr;

    const recentPayments = (recentPaymentsData || []).map(p => ({
      amount: p.amount,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      paid_by: p.paid_by,
      student_name: p.students ? `${p.students.first_name || ''} ${p.students.last_name || ''}`.trim() : '',
      class_name: p.students?.class_name || ''
    }));

    // Fee defaulters - simplified calculation
    let defaultersCount = 0;
    try {
      const { data: allStudents, error: stuListErr } = await supabase
        .from('students')
        .select('student_id')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .eq('status', 'active');
      if (stuListErr) throw stuListErr;

      const studentIds = allStudents?.map(s => s.student_id) || [];
      if (studentIds.length > 0) {
        const { data: allPayments, error: payListErr } = await supabase
          .from('payments')
          .select('student_id, amount')
          .eq('school_id', schoolId)
          .eq('status', 'paid')
          .eq('is_deleted', false)
          .in('student_id', studentIds);
        if (payListErr) throw payListErr;

        const paymentMap = {};
        allPayments?.forEach(p => {
          paymentMap[p.student_id] = (paymentMap[p.student_id] || 0) + Number(p.amount);
        });

        // Count students with less than 10000 paid (simplified threshold)
        defaultersCount = studentIds.filter(id => (paymentMap[id] || 0) < 10000).length;
      }
    } catch { /* ignore */ }

    // HR summary
    let hrSummary = null;
    if (["admin", "hr"].includes(role)) {
      const { count: totalStaff, error: staffErr } = await supabase
        .from('hr_staff')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (staffErr) throw staffErr;

      const { data: payrollData, error: payRollErr } = await supabase
        .from('hr_staff')
        .select('salary, status')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (payRollErr) throw payRollErr;

      const totalPayroll = payrollData?.reduce((sum, s) => sum + Number(s.salary || 0), 0) || 0;
      const activeStaff = payrollData?.filter(s => s.status === 'active').length || 0;
      const onLeave = payrollData?.filter(s => s.status === 'on-leave').length || 0;

      hrSummary = {
        totalStaff: totalStaff || 0,
        totalPayroll,
        activeStaff,
        onLeave
      };
    }

    res.json({ counts, monthly, attendance, byClass, grades, recentPayments, defaultersCount, hrSummary });
  } catch (err) { next(err); }
});

export default router;