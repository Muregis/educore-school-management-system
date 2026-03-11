import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId, date, from, to, studentId } = req.query;

    let sql = `SELECT a.attendance_id, a.student_id,
                      CONCAT(s.first_name,' ',s.last_name) AS student_name,
                      s.admission_number, s.class_name, a.attendance_date, a.status, a.class_id
            FROM attendance a
              JOIN students s ON s.student_id = a.student_id
              WHERE a.school_id = ? AND a.is_deleted = 0`;
    const params = [schoolId];

    if (classId)   { sql += " AND a.class_id = ?";        params.push(classId); }
    if (studentId) { sql += " AND a.student_id = ?";      params.push(studentId); }
    if (date)      { sql += " AND a.attendance_date = ?"; params.push(date); }
    if (from)      { sql += " AND a.attendance_date >= ?";params.push(from); }
    if (to)        { sql += " AND a.attendance_date <= ?";params.push(to); }

    sql += " ORDER BY a.attendance_date DESC, a.attendance_id DESC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Helper: resolve classId from either numeric ID or class_name string ───────
async function resolveClassId(schoolId, classId) {
  // Already a number
  if (!isNaN(Number(classId)) && Number(classId) > 0) return Number(classId);
  // Try looking up by name
  const [cls] = await pool.query(
    `SELECT class_id FROM classes WHERE school_id=? AND class_name=? AND is_deleted=0 LIMIT 1`,
    [schoolId, classId]
  );
  if (cls.length) return cls[0].class_id;
  // Class not in classes table — auto-create a placeholder so FK is satisfied
  const [result] = await pool.query(
    `INSERT INTO classes (school_id, class_name, academic_year, status) VALUES (?, ?, YEAR(CURDATE()), 'active')`,
    [schoolId, classId]
  );
  return result.insertId;
}

// ── Bulk attendance save ──────────────────────────────────────────────────────
router.post("/bulk", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records) || !records.length)
      return res.status(400).json({ message: "classId, date and records array are required" });

    const resolvedClassId = await resolveClassId(schoolId, classId);

    // Delete existing for this class+date then re-insert
    await pool.query(
      `DELETE FROM attendance WHERE school_id=? AND class_id=? AND attendance_date=?`,
      [schoolId, resolvedClassId, date]
    );

    const values = records.map(r => [
      schoolId,
      r.studentId ?? r.student_id,
      resolvedClassId,
      date,
      r.status || "present",
      userId || null
    ]);

    await pool.query(
      `INSERT INTO attendance (school_id, student_id, class_id, attendance_date, status, marked_by_user_id) VALUES ?`,
      [values]
    );

    res.status(201).json({ saved: records.length });
  } catch (err) { next(err); }
});

// ── Single attendance record ──────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { studentId, classId, date, status = "present" } = req.body;
    if (!studentId || !classId || !date)
      return res.status(400).json({ message: "studentId, classId and date are required" });

    const resolvedClassId = await resolveClassId(schoolId, classId);

    await pool.query(
      `INSERT INTO attendance (school_id, student_id, class_id, attendance_date, status, marked_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status=VALUES(status), updated_at=CURRENT_TIMESTAMP`,
      [schoolId, studentId, resolvedClassId, date, status, userId || null]
    );
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, date } = req.body;
    const [result] = await pool.query(
      `UPDATE attendance SET status=?, attendance_date=?, updated_at=CURRENT_TIMESTAMP
      WHERE attendance_id=? AND school_id=?`,
      [status, date, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Record not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pool.query(
      `UPDATE attendance SET is_deleted=1 WHERE attendance_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;