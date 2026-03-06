import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT discipline_id, student_id, teacher_id, incident_type, incident_details, action_taken, incident_date, status
       FROM discipline_records
       WHERE school_id = ? AND is_deleted = 0
       ORDER BY incident_date DESC, discipline_id DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, teacherId = null, incidentType, incidentDetails = null, actionTaken = null, incidentDate, status = "open" } = req.body;

    if (!studentId || !incidentType || !incidentDate) {
      return res.status(400).json({ message: "studentId, incidentType, incidentDate are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO discipline_records (school_id, student_id, teacher_id, incident_type, incident_details, action_taken, incident_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, studentId, teacherId, incidentType, incidentDetails, actionTaken, incidentDate, status]
    );

    res.status(201).json({ disciplineId: result.insertId });
  } catch (err) {
    next(err);
  }
});

export default router;
