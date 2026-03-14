import { Router } from "express";
import { pool } from "../config/db.js";
import { pgPool } from "../config/pg.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

const usePgDisciplineGet =
  String(process.env.USE_PG_DISCIPLINE_GET || "").toLowerCase() === "true";

router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role, studentId: tokenStudentId } = req.user;

    // Portal users can only see their own student's records
    const filterStudentId = ["parent","student"].includes(role) ? tokenStudentId : (req.query.studentId || null);

    if (usePgDisciplineGet) {
      let sql = `SELECT d.discipline_id, d.student_id, s.first_name, s.last_name,
                        s.admission_number, d.incident_type, d.incident_details,
                        d.action_taken, d.incident_date, d.status
                 FROM discipline_records d
                 JOIN students s ON s.student_id = d.student_id
                 WHERE d.school_id = $1 AND d.is_deleted = false`;
      const params = [schoolId];
      if (filterStudentId) { sql += " AND d.student_id = $2"; params.push(filterStudentId); }
      sql += " ORDER BY d.incident_date DESC, d.discipline_id DESC";

      const { rows } = await pgPool.query(sql, params);
      return res.json(rows);
    }

    let sql = `SELECT d.discipline_id, d.student_id, s.first_name, s.last_name,
                      s.admission_number, d.incident_type, d.incident_details,
                      d.action_taken, d.incident_date, d.status
               FROM discipline_records d
               JOIN students s ON s.student_id = d.student_id
               WHERE d.school_id = ? AND d.is_deleted = 0`;
    const params = [schoolId];

    if (filterStudentId) { sql += " AND d.student_id = ?"; params.push(filterStudentId); }

    sql += " ORDER BY d.incident_date DESC, d.discipline_id DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, teacherId = null, incidentType, incidentDetails = null, actionTaken = null, incidentDate, status = "open" } = req.body;
    if (!studentId || !incidentType || !incidentDate)
      return res.status(400).json({ message: "studentId, incidentType, incidentDate are required" });

    const [result] = await pool.query(
      `INSERT INTO discipline_records (school_id, student_id, teacher_id, incident_type, incident_details, action_taken, incident_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, studentId, teacherId, incidentType, incidentDetails, actionTaken, incidentDate, status]
    );
    res.status(201).json({ disciplineId: result.insertId });
  } catch (err) { next(err); }
});

router.put("/:id", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, actionTaken } = req.body;
    const [result] = await pool.query(
      `UPDATE discipline_records SET status=?, action_taken=?, updated_at=CURRENT_TIMESTAMP
       WHERE discipline_id=? AND school_id=? AND is_deleted=0`,
      [status, actionTaken || null, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Record not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

export default router;
