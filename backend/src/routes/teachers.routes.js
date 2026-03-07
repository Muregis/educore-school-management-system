import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// GET list of teachers for the current school
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT teacher_id, staff_number, national_id, first_name, last_name,
              email, phone, department, qualification, status, hire_date, created_at
       FROM teachers
       WHERE school_id = ? AND is_deleted = 0
       ORDER BY teacher_id DESC`,
      [schoolId]
    );
    res.json(rows.map(r => ({
      id: r.teacher_id,
      staffNumber: r.staff_number,
      nationalId: r.national_id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      department: r.department,
      qualification: r.qualification,
      status: r.status,
      hireDate: r.hire_date,
      createdAt: r.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

// GET individual teacher
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT * FROM teachers WHERE teacher_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Teacher not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST create
router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { firstName, lastName, email, phone = null, department = null, qualification = null, status = "active", staffNumber = null, nationalId = null, hireDate = null } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ message: "firstName and lastName are required" });
    }
    const [result] = await pool.query(
      `INSERT INTO teachers (school_id, first_name, last_name, email, phone, department, qualification, status, staff_number, national_id, hire_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, firstName, lastName, email, phone, department, qualification, status, staffNumber, nationalId, hireDate]
    );
    res.status(201).json({ teacherId: result.insertId });
  } catch (err) {
    next(err);
  }
});

// PUT update
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { firstName, lastName, email, phone, department, qualification, status, staffNumber, nationalId, hireDate } = req.body;
    const [result] = await pool.query(
      `UPDATE teachers SET first_name=?, last_name=?, email=?, phone=?, department=?, qualification=?, status=?, staff_number=?, national_id=?, hire_date=?, updated_at=CURRENT_TIMESTAMP
       WHERE teacher_id=? AND school_id=? AND is_deleted=0`,
      [firstName, lastName, email, phone || null, department || null, qualification || null, status || "active", staffNumber || null, nationalId || null, hireDate || null, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Teacher not found" });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// DELETE soft
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE teachers SET is_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE teacher_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Teacher not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
