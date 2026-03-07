import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// Get timetable entries (filter by class or teacher)
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, teacherId } = req.query;
    let sql = `SELECT t.timetable_id, t.class_name, t.day_of_week, t.period,
                      t.start_time, t.end_time, t.subject, t.teacher_id,
                      CONCAT(tc.first_name,' ',tc.last_name) AS teacher_name
               FROM timetable t
               LEFT JOIN teachers tc ON tc.teacher_id = t.teacher_id
               WHERE t.school_id = ? AND t.is_deleted = 0`;
    const params = [schoolId];
    if (className) { sql += " AND t.class_name = ?"; params.push(className); }
    if (teacherId) { sql += " AND t.teacher_id = ?"; params.push(teacherId); }
    sql += " ORDER BY FIELD(t.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday'), t.start_time";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// Create timetable entry
router.post("/", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, dayOfWeek, period, startTime, endTime, subject, teacherId } = req.body;
    if (!className || !dayOfWeek || !subject || !startTime || !endTime)
      return res.status(400).json({ message: "className, dayOfWeek, subject, startTime, endTime are required" });

    const [result] = await pool.query(
      `INSERT INTO timetable (school_id, class_name, day_of_week, period, start_time, end_time, subject, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, className, dayOfWeek, period || null, startTime, endTime, subject, teacherId || null]
    );
    res.status(201).json({ timetableId: result.insertId });
  } catch (err) { next(err); }
});

// Update timetable entry
router.put("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, dayOfWeek, period, startTime, endTime, subject, teacherId } = req.body;
    const [result] = await pool.query(
      `UPDATE timetable SET class_name=?, day_of_week=?, period=?, start_time=?, end_time=?, subject=?, teacher_id=?, updated_at=CURRENT_TIMESTAMP
       WHERE timetable_id=? AND school_id=? AND is_deleted=0`,
      [className, dayOfWeek, period || null, startTime, endTime, subject, teacherId || null, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Entry not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// Delete timetable entry
router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE timetable SET is_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE timetable_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Entry not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
