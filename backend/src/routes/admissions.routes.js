import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// GET all applications
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.query;
    let sql = `SELECT * FROM admissions WHERE school_id=? AND is_deleted=0`;
    const params = [schoolId];
    if (status) { sql += " AND status=?"; params.push(status); }
    sql += " ORDER BY created_at DESC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST new application
router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { fullName, dateOfBirth, gender, parentName, parentPhone, parentEmail, address, previousSchool, applyingClass, academicYear = "2026", notes } = req.body;
    if (!fullName || !applyingClass) return res.status(400).json({ message: "fullName and applyingClass are required" });
    const [result] = await pool.query(
      `INSERT INTO admissions (school_id, full_name, date_of_birth, gender, parent_name, parent_phone, parent_email, address, previous_school, applying_class, academic_year, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, fullName, dateOfBirth||null, gender||null, parentName||null, parentPhone||null, parentEmail||null, address||null, previousSchool||null, applyingClass, academicYear, notes||null]
    );
    res.status(201).json({ admissionId: result.insertId });
  } catch (err) { next(err); }
});

// PATCH update status
router.patch("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, notes } = req.body;
    await pool.query(
      `UPDATE admissions SET status=?, notes=COALESCE(?,notes), updated_at=CURRENT_TIMESTAMP WHERE admission_id=? AND school_id=?`,
      [status, notes||null, req.params.id, schoolId]
    );
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// DELETE
router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pool.query(`UPDATE admissions SET is_deleted=1 WHERE admission_id=? AND school_id=?`, [req.params.id, schoolId]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
