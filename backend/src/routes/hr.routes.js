import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

const HR_ROLES = ["admin","hr"];

// ═══════════════════════════════════════════════════════════════════
// STAFF RECORDS
// ═══════════════════════════════════════════════════════════════════
router.get("/staff", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: rows } = await pool.query(
      `SELECT * FROM hr_staff WHERE school_id=? AND is_deleted=0 ORDER BY department, full_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/staff", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { fullName, email, phone, department, jobTitle, contractType, startDate, salary, status, nationalId, notes } = req.body;
    if (!fullName || !jobTitle) return res.status(400).json({ message: "fullName and jobTitle are required" });
    const { data: result } = await pool.query(
      `INSERT INTO hr_staff (school_id, full_name, email, phone, department, job_title, contract_type, start_date, salary, status, national_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, fullName, email||null, phone||null, department||"Academic", jobTitle,
      contractType||"Permanent", startDate||null, salary||0, status||"active", nationalId||null, notes||null]
    );
    // OLD:
    // const [row] = await pool.query(`SELECT * FROM hr_staff WHERE staff_id=?`, [result.insertId]);
    const { data: row } = await pool.query(`SELECT * FROM hr_staff WHERE staff_id=? AND school_id=?`, [result.insertId, schoolId]);
    res.status(201).json(row[0]);
  } catch (err) { next(err); }
});

router.put("/staff/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { fullName, email, phone, department, jobTitle, contractType, startDate, salary, status, nationalId, notes } = req.body;
    const { data: result } = await pool.query(
      `UPDATE hr_staff SET full_name=?, email=?, phone=?, department=?, job_title=?, contract_type=?,
      start_date=?, salary=?, status=?, national_id=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE staff_id=? AND school_id=? AND is_deleted=0`,
      [fullName, email||null, phone||null, department, jobTitle, contractType,
      startDate||null, salary||0, status, nationalId||null, notes||null, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Staff not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/staff/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pool.query(`UPDATE hr_staff SET is_deleted=1 WHERE staff_id=? AND school_id=?`, [req.params.id, schoolId]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════
// LEAVE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
router.get("/leave", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: rows } = await pool.query(
      `SELECT l.*, s.full_name AS staff_name, s.department, s.job_title
      FROM hr_leave l
      JOIN hr_staff s ON s.staff_id = l.staff_id
      WHERE l.school_id=? AND l.is_deleted=0
      ORDER BY l.created_at DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/leave", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { staffId, leaveType, fromDate, toDate, reason } = req.body;
    if (!staffId || !fromDate || !toDate)
      return res.status(400).json({ message: "staffId, fromDate, toDate are required" });
    const { data: result } = await pool.query(
      `INSERT INTO hr_leave (school_id, staff_id, leave_type, from_date, to_date, reason)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolId, staffId, leaveType||"Annual", fromDate, toDate, reason||null]
    );
    res.status(201).json({ leaveId: result.insertId });
  } catch (err) { next(err); }
});

router.patch("/leave/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.body;
    if (!["approved","rejected","pending"].includes(status))
      return res.status(400).json({ message: "Invalid status" });
    await pool.query(
      `UPDATE hr_leave SET status=?, updated_at=CURRENT_TIMESTAMP WHERE leave_id=? AND school_id=?`,
      [status, req.params.id, schoolId]
    );
    // If approved — update staff status to on-leave
    if (status === "approved") {
      const { data: leave } = await pool.query(`SELECT staff_id FROM hr_leave WHERE leave_id=?`, [req.params.id]);
      if (leave.length) {
        await pool.query(`UPDATE hr_staff SET status='on-leave' WHERE staff_id=? AND school_id=?`, [leave[0].staff_id, schoolId]);
      }
    }
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════
// STAFF ATTENDANCE
// ═══════════════════════════════════════════════════════════════════
router.get("/attendance", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { date, from, to, staffId, department } = req.query;

    let sql = `
      SELECT a.*, s.full_name AS staff_name, s.department, s.job_title
      FROM hr_attendance a
      JOIN hr_staff s ON s.staff_id = a.staff_id
      WHERE a.school_id=? AND a.is_deleted=0`;
    const params = [schoolId];

    if (staffId)    { sql += " AND a.staff_id=?";         params.push(staffId); }
    if (department) { sql += " AND s.department=?";       params.push(department); }
    if (date)       { sql += " AND a.attendance_date=?";  params.push(date); }
    if (from)       { sql += " AND a.attendance_date>=?"; params.push(from); }
    if (to)         { sql += " AND a.attendance_date<=?"; params.push(to); }

    sql += " ORDER BY a.attendance_date DESC, s.full_name";
    const { data: rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// Bulk staff attendance save
router.post("/attendance/bulk", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { date, records } = req.body;

    if (!date || !Array.isArray(records) || !records.length)
      return res.status(400).json({ message: "date and records array are required" });

    // Delete existing for this date then re-insert
    await pool.query(
      `DELETE FROM hr_attendance WHERE school_id=? AND attendance_date=?`,
      [schoolId, date]
    );

    const values = records.map(r => [
      schoolId, r.staffId, date,
      r.checkIn || null, r.checkOut || null,
      r.status || "present", r.notes || null, userId
    ]);

    await pool.query(
      `INSERT INTO hr_attendance (school_id, staff_id, attendance_date, check_in, check_out, status, notes, marked_by) VALUES ?`,
      [values]
    );
    res.status(201).json({ saved: records.length });
  } catch (err) { next(err); }
});

// Single staff attendance
router.post("/attendance", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { staffId, date, checkIn, checkOut, status = "present", notes } = req.body;
    if (!staffId || !date) return res.status(400).json({ message: "staffId and date are required" });
    await pool.query(
      `INSERT INTO hr_attendance (school_id, staff_id, attendance_date, check_in, check_out, status, notes, marked_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out),
      status=VALUES(status), notes=VALUES(notes), updated_at=CURRENT_TIMESTAMP`,
      [schoolId, staffId, date, checkIn||null, checkOut||null, status, notes||null, userId]
    );
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════
// PAYROLL & PAYSLIPS
// ═══════════════════════════════════════════════════════════════════
router.get("/payslips", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year, staffId } = req.query;

    let sql = `
      SELECT p.*, s.full_name AS staff_name, s.department, s.job_title, s.national_id
      FROM hr_payslips p
      JOIN hr_staff s ON s.staff_id = p.staff_id
      WHERE p.school_id=? AND p.is_deleted=0`;
    const params = [schoolId];

    if (month)   { sql += " AND p.month=?";    params.push(month); }
    if (year)    { sql += " AND p.year=?";     params.push(year); }
    if (staffId) { sql += " AND p.staff_id=?"; params.push(staffId); }

    sql += " ORDER BY p.year DESC, p.month DESC, s.full_name";
    const { data: rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// Generate payslips for all active staff for a given month/year
router.post("/payslips/generate", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { month, year, allowances = 0, notes } = req.body;
    if (!month || !year) return res.status(400).json({ message: "month and year are required" });

    const { data: activeStaff } = await pool.query(
      `SELECT * FROM hr_staff WHERE school_id=? AND is_deleted=0 AND status='active'`,
      [schoolId]
    );

    let generated = 0;
    for (const s of activeStaff) {
      const basic    = Number(s.salary) || 0;
      const allow    = Number(allowances) || 0;
      // Simplified KE statutory deductions
      const paye     = basic > 24000 ? Math.round((basic - 24000) * 0.1) : 0;
      const nhif     = basic > 100000 ? 1700 : basic > 50000 ? 1500 : basic > 20000 ? 900 : 500;
      const nssf     = Math.min(Math.round(basic * 0.06), 2160);
      const deduct   = paye + nhif + nssf;
      const netPay   = basic + allow - deduct;

      await pool.query(
        `INSERT INTO hr_payslips (school_id, staff_id, month, year, basic_salary, allowances, deductions, net_pay, paye, nhif, nssf, notes, status, generated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
        ON DUPLICATE KEY UPDATE basic_salary=VALUES(basic_salary), allowances=VALUES(allowances),
        deductions=VALUES(deductions), net_pay=VALUES(net_pay), paye=VALUES(paye),
        nhif=VALUES(nhif), nssf=VALUES(nssf), updated_at=CURRENT_TIMESTAMP`,
        [schoolId, s.staff_id, month, year, basic, allow, deduct, netPay, paye, nhif, nssf, notes||null, userId]
      );
      generated++;
    }
    res.status(201).json({ generated });
  } catch (err) { next(err); }
});

// Approve all payslips for a month
router.patch("/payslips/approve", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year } = req.body;
    await pool.query(
      `UPDATE hr_payslips SET status='approved', updated_at=CURRENT_TIMESTAMP
      WHERE school_id=? AND month=? AND year=? AND status='draft' AND is_deleted=0`,
      [schoolId, month, year]
    );
    res.json({ approved: true });
  } catch (err) { next(err); }
});

// Mark payslips as paid for a month
router.patch("/payslips/mark-paid", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year } = req.body;
    await pool.query(
      `UPDATE hr_payslips SET status='paid', paid_date=CURDATE(), updated_at=CURRENT_TIMESTAMP
      WHERE school_id=? AND month=? AND year=? AND status='approved' AND is_deleted=0`,
      [schoolId, month, year]
    );
    res.json({ paid: true });
  } catch (err) { next(err); }
});

// Single payslip update (allowances/notes override)
router.put("/payslips/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { allowances, deductions, notes, status } = req.body;
    const { data: rows } = await pool.query(`SELECT * FROM hr_payslips WHERE payslip_id=? AND school_id=?`, [req.params.id, schoolId]);
    if (!rows.length) return res.status(404).json({ message: "Payslip not found" });
    const p = rows[0];
    const allow  = allowances !== undefined ? Number(allowances) : Number(p.allowances);
    const deduct = deductions !== undefined ? Number(deductions) : Number(p.deductions);
    const net    = Number(p.basic_salary) + allow - deduct;
    await pool.query(
      `UPDATE hr_payslips SET allowances=?, deductions=?, net_pay=?, notes=?, status=COALESCE(?,status), updated_at=CURRENT_TIMESTAMP
      WHERE payslip_id=? AND school_id=?`,
      [allow, deduct, net, notes||p.notes, status||null, req.params.id, schoolId]
    );
    res.json({ updated: true });
  } catch (err) { next(err); }
});

export default router;