import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// list attendance records with optional filters
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, classId, date } = req.query;
    let sql = `SELECT attendance_id, student_id, class_id, attendance_date, status, remarks, marked_by_user_id
               FROM attendance WHERE school_id = ? AND is_deleted = 0`;
    const params = [schoolId];
    if (studentId) { sql += " AND student_id = ?"; params.push(studentId); }
    if (classId) { sql += " AND class_id = ?"; params.push(classId); }
    if (date) { sql += " AND attendance_date = ?"; params.push(date); }
    sql += " ORDER BY attendance_date DESC, attendance_id DESC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// get single record
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT * FROM attendance WHERE attendance_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Record not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// create attendance
router.post("/", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { studentId, classId, attendanceDate, status, remarks = null } = req.body;
    if (!studentId || !classId || !attendanceDate || !status) {
      return res.status(400).json({ message: "studentId, classId, attendanceDate and status are required" });
    }
    const [result] = await pool.query(
      `INSERT INTO attendance (school_id, student_id, class_id, attendance_date, status, remarks, marked_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, studentId, classId, attendanceDate, status, remarks, userId]
    );
    res.status(201).json({ attendanceId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Attendance already recorded for this student/date" });
    }
    next(err);
  }
});

// update record
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, remarks, attendanceDate } = req.body;
    const [result] = await pool.query(
      `UPDATE attendance SET status=?, remarks=?, attendance_date=?, updated_at=CURRENT_TIMESTAMP
       WHERE attendance_id=? AND school_id=? AND is_deleted=0`,
      [status, remarks || null, attendanceDate, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Record not found" });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// soft delete
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE attendance SET is_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE attendance_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Record not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
