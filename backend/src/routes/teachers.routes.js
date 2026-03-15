import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT teacher_id, staff_number, first_name, last_name, email, phone,
              department, qualification, status, hire_date, created_at
      FROM teachers WHERE school_id=? AND is_deleted=0 ORDER BY first_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/", requireRoles("admin","hr"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { firstName, lastName, email, phone, staffNumber, department,
            qualification, hireDate, status = "active", subjects = [] } = req.body;

    if (!firstName || !lastName || !email)
      return res.status(400).json({ message: "firstName, lastName and email are required" });

    const [result] = await pool.query(
      `INSERT INTO teachers (school_id, first_name, last_name, email, phone,
        staff_number, department, qualification, hire_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, firstName, lastName, email, phone||null,
      staffNumber||null, department||null, qualification||null,
      hireDate||null, status]
    );

    // Auto-create teacher login account (email, password = email prefix before @)
    try {
      const defaultPass = email.split("@")[0];
      const hash = await bcrypt.hash(defaultPass, 10);
      await pool.query(
        `INSERT IGNORE INTO users (school_id, full_name, email, password_hash, role, status)
        VALUES (?, ?, ?, ?, 'teacher', 'active')`,
        [schoolId, `${firstName} ${lastName}`, email, hash]
      );
    } catch { /* ignore duplicate */ }

    const [newRow] = await pool.query(
      `SELECT * FROM teachers WHERE teacher_id=? AND school_id=? LIMIT 1`, [result.insertId, schoolId]
    );
    res.status(201).json({ ...newRow[0], defaultPassword: email.split("@")[0] });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Email or staff number already exists" });
    next(err);
  }
});

router.put("/:id", requireRoles("admin","hr"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { firstName, lastName, email, phone, staffNumber,
            department, qualification, hireDate, status } = req.body;
    const [result] = await pool.query(
      `UPDATE teachers SET first_name=?, last_name=?, email=?, phone=?,
      staff_number=?, department=?, qualification=?, hire_date=?, status=?,
      updated_at=CURRENT_TIMESTAMP
      WHERE teacher_id=? AND school_id=? AND is_deleted=0`,
      [firstName, lastName, email, phone||null, staffNumber||null,
      department||null, qualification||null, hireDate||null, status||"active",
      req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Teacher not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pool.query(
      `UPDATE teachers SET is_deleted=1, updated_at=CURRENT_TIMESTAMP
      WHERE teacher_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;