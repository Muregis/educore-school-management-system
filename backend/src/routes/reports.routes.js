import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

// NEW: reports route expects a `database` interface (Supabase wrapper)
// Use the unified `pool` export (now backed by Supabase) for compatibility.
const database = pool;

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin", "teacher", "finance"));

// ─── Summary dashboard stats ──────────────────────────────────────────────────
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    // Get counts using pool
    const { data: students } = await pool.query(
      'SELECT 1 FROM students WHERE school_id = ? AND is_deleted = false LIMIT 1',
      [schoolId]
    );
    const totalStudents = students?.length || 0;

    const { data: teachers } = await pool.query(
      'SELECT 1 FROM teachers WHERE school_id = ? AND is_deleted = false LIMIT 1',
      [schoolId]
    );
    const totalTeachers = teachers?.length || 0;

    const { data: paidPayments } = await pool.query(
      'SELECT amount FROM payments WHERE school_id = ? AND status = ? AND is_deleted = false',
      [schoolId, 'paid']
    );
    const totalCollected = paidPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const { data: pendingPayments } = await pool.query(
      'SELECT amount FROM payments WHERE school_id = ? AND status = ? AND is_deleted = false',
      [schoolId, 'pending']
    );
    const totalPending = pendingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const today = new Date().toISOString().split('T')[0];
    const { data: presentToday } = await pool.query(
      'SELECT 1 FROM attendance WHERE school_id = ? AND attendance_date = ? AND status = ? AND is_deleted = false LIMIT 1',
      [schoolId, today, 'present']
    );
    const presentCount = presentToday?.length || 0;

    const { data: absentToday } = await pool.query(
      'SELECT 1 FROM attendance WHERE school_id = ? AND attendance_date = ? AND status = ? AND is_deleted = false LIMIT 1',
      [schoolId, today, 'absent']
    );
    const absentCount = absentToday?.length || 0;

    res.json({ totalStudents, totalTeachers, totalCollected, totalPending, presentToday: presentCount, absentToday: absentCount });
  } catch (err) { next(err); }
});

// ─── Monthly fee collection ───────────────────────────────────────────────────
router.get("/monthly-fee-collection", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    // Get monthly payment data using Supabase
    const { data: payments } = await database.query('payments', {
      select: 'payment_date, amount',
      where: { school_id: schoolId, status: 'paid', is_deleted: false },
      order: { column: 'payment_date', ascending: false }
    });

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
    
    // Get attendance data using Supabase
    // OLD: const { data: attendance } = await database.rpc('get_attendance_rate_by_class', { p_school_id: schoolId });
    let attendance = null;
    try {
      const { data } = await database.rpc('get_attendance_rate_by_class', { p_school_id: schoolId });
      attendance = data;
    } catch {
      // RPC missing/unavailable — fall back below
      attendance = null;
    }
    
    // Fallback to simpler query if RPC not available
    if (!attendance) {
      const { data: students } = await database.query('students', {
        select: 'class_name',
        where: { school_id: schoolId, is_deleted: false }
      });
      
      const classStats = {};
      students?.forEach(student => {
        if (!classStats[student.class_name]) {
          classStats[student.class_name] = { total: 0, present: 0 };
        }
        classStats[student.class_name].total++;
      });
      
      const { data: attendanceRecords } = await database.query('attendance', {
        select: 'status',
        where: { school_id: schoolId, is_deleted: false }
      });
      
      attendanceRecords?.forEach(record => {
        const student = students?.find(s => s.student_id === record.student_id);
        if (student && record.status === 'present') {
          if (classStats[student.class_name]?.present !== undefined) {
            classStats[student.class_name].present++;
          }
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
    
    // Get fee defaulters using Supabase
    // OLD: const { data: students } = await database.rpc('get_fee_defaulters', { p_school_id: schoolId });
    let students = null;
    try {
      const { data } = await database.rpc('get_fee_defaulters', { p_school_id: schoolId });
      students = data;
    } catch {
      // RPC missing/unavailable — fall back below
      students = null;
    }
    
    // Fallback to simpler query if RPC not available
    if (!students) {
      const { data: allStudents } = await database.query('students', {
        select: 'student_id, first_name, last_name, admission_number, class_name, parent_phone',
        where: { school_id: schoolId, is_deleted: false }
      });
      
      const { data: payments } = await database.query('payments', {
        select: 'student_id, amount',
        where: { school_id: schoolId, status: 'paid', is_deleted: false }
      });
      
      const paymentMap = {};
      payments?.forEach(payment => {
        if (!paymentMap[payment.student_id]) {
          paymentMap[payment.student_id] = 0;
        }
        paymentMap[payment.student_id] += Number(payment.amount);
      });
      
      const defaulters = allStudents?.filter(student => {
        const paid = paymentMap[student.student_id] || 0;
        // This is simplified - in real implementation you'd calculate expected fees
        return paid < 10000; // Example threshold
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
    
    // Get grade distribution using Supabase
    // OLD: const { data: grades } = await database.rpc('get_grade_distribution', { p_school_id: schoolId });
    let grades = null;
    try {
      const { data } = await database.rpc('get_grade_distribution', { p_school_id: schoolId });
      grades = data;
    } catch {
      // RPC missing/unavailable — fall back below
      grades = null;
    }
    
    // Fallback to simpler query if RPC not available
    if (!grades) {
      // OLD: const { data: results } = await database.query('results', {
      // OLD:   select: 'subject, marks_obtained',
      // OLD:   where: { school_id: schoolId, is_deleted: false }
      // OLD: });
      const { data: results } = await database.query('results', {
        select: 'subject, marks',
        where: { school_id: schoolId, is_deleted: false }
      });
      
      const subjectStats = {};
      results?.forEach(result => {
        if (!subjectStats[result.subject]) {
          subjectStats[result.subject] = { scores: [], entries: 0 };
        }
        // OLD: subjectStats[result.subject].scores.push(Number(result.marks_obtained));
        subjectStats[result.subject].scores.push(Number(result.marks));
        subjectStats[result.subject].entries++;
      });
      
      const distribution = Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        avgScore: stats.scores.length > 0 ? Math.round(stats.scores.reduce((a, b) => a + b) / stats.scores.length) : 0,
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

    // Get student info using Supabase
    const { data: students } = await database.query('students', {
      select: 'student_id, first_name, last_name, admission_number, class_name, gender',
      where: { student_id: studentId, school_id: schoolId, is_deleted: false },
      limit: 1
    });
    
    const student = students?.[0];
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Get grades using Supabase
    // OLD: const { data: grades } = await database.query('results', {
    // OLD:   select: 'subject, term, marks_obtained, total_marks, grade, teacher_comment',
    // OLD:   where: { student_id: studentId, school_id: schoolId, is_deleted: false },
    // OLD:   order: [{ column: 'term', ascending: true }, { column: 'subject', ascending: true }]
    // OLD: });
    const { data: grades } = await database.query('results', {
      select: 'subject, term, marks, total_marks, grade, teacher_comment',
      where: { student_id: studentId, school_id: schoolId, is_deleted: false },
      order: [{ column: 'term', ascending: true }, { column: 'subject', ascending: true }]
    });

    // Get attendance using Supabase
    const { data: attendance } = await database.query('attendance', {
      select: 'status',
      where: { student_id: studentId, school_id: schoolId, is_deleted: false }
    });
    
    const attendanceStats = {};
    attendance?.forEach(record => {
      if (!attendanceStats[record.status]) {
        attendanceStats[record.status] = 0;
      }
      attendanceStats[record.status]++;
    });

    // Get payments using Supabase
    const { data: payments } = await database.query('payments', {
      select: 'amount',
      where: { student_id: studentId, school_id: schoolId, status: 'paid', is_deleted: false }
    });
    
    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    res.json({ student, grades, attendance: attendanceStats, totalPaid });
  } catch (err) { next(err); }
});

export default router;
