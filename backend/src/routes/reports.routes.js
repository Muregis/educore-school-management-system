import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin", "teacher", "finance"));

// ─── Summary dashboard stats ──────────────────────────────────────────────────
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const { count: totalStudents, error: stuErr } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (stuErr) throw stuErr;

    const { count: totalTeachers, error: teaErr } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (teaErr) throw teaErr;

    const { data: paidPayments, error: paidErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('status', 'paid')
      .eq('is_deleted', false);
    if (paidErr) throw paidErr;
    const totalCollected = paidPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const { data: pendingPayments, error: pendErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .eq('is_deleted', false);
    if (pendErr) throw pendErr;
    const totalPending = pendingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const today = new Date().toISOString().split('T')[0];
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

    res.json({ totalStudents: totalStudents || 0, totalTeachers: totalTeachers || 0, totalCollected, totalPending, presentToday: presentCount || 0, absentToday: absentCount || 0 });
  } catch (err) { next(err); }
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
    
    let students = null;
    try {
      const { data } = await supabase.rpc('get_fee_defaulters', { p_school_id: schoolId });
      students = data;
    } catch {
      students = null;
    }
    
    // Fallback to simpler query if RPC not available
    if (!students) {
      const { data: allStudents, error: stuErr } = await supabase
        .from('students')
        .select('student_id, first_name, last_name, admission_number, class_name, parent_phone')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (stuErr) throw stuErr;
      
      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('student_id, amount')
        .eq('school_id', schoolId)
        .eq('status', 'paid')
        .eq('is_deleted', false);
      if (payErr) throw payErr;
      
      const paymentMap = {};
      payments?.forEach(payment => {
        if (!paymentMap[payment.student_id]) {
          paymentMap[payment.student_id] = 0;
        }
        paymentMap[payment.student_id] += Number(payment.amount);
      });
      
      const defaulters = allStudents?.filter(student => {
        const paid = paymentMap[student.student_id] || 0;
        return paid < 10000;
      }).map(student => ({
        ...student,
        paid: paymentMap[student.student_id] || 0,
        balance: 10000 - (paymentMap[student.student_id] || 0)
      }));
      
      return res.json(defaulters);
    }
    
    res.json(students || []);
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
