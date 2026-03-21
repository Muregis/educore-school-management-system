import { Router } from "express";
import bcrypt from "bcryptjs";
import { pgPool } from "../config/pg.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { rows } = await pgPool.query(
      `SELECT teacher_id, staff_number, tsc_staff_id, first_name, last_name, email, phone,
              department, qualification, status, hire_date, created_at
      FROM teachers WHERE school_id=$1 AND is_deleted=false ORDER BY first_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/", requireRoles("admin","hr"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { firstName, lastName, email, phone, staffNumber, tscStaffId, department,
            qualification, hireDate, status = "active" } = req.body;

    if (!firstName || !lastName || !email)
      return res.status(400).json({ message: "firstName, lastName and email are required" });

    const { rows } = await pgPool.query(
      `INSERT INTO teachers (school_id, first_name, last_name, email, phone,
        staff_number, tsc_staff_id, department, qualification, hire_date, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [schoolId, firstName, lastName, email, phone||null,
        staffNumber||null, tscStaffId||null, department||null, qualification||null,
        hireDate||null, status]
    );
    const result = rows[0];

    // Auto-create teacher login account (email, password = email prefix before @)
    try {
      const defaultPass = email.split("@")[0];
      const hash = await bcrypt.hash(defaultPass, 10);
      await pgPool.query(
        `INSERT INTO users (school_id, full_name, email, password_hash, role, status)
        VALUES ($1, $2, $3, $4, 'teacher', 'active')
        ON CONFLICT (school_id, email) DO NOTHING`,
        [schoolId, `${firstName} ${lastName}`, email, hash]
      );
    } catch (e) {
      console.warn('Could not create teacher user account:', e.message);
    }

    const { rows: newRow } = await pgPool.query(
      `SELECT * FROM teachers WHERE teacher_id=$1 AND school_id=$2 LIMIT 1`, [result.teacher_id, schoolId]
    );
    res.status(201).json({ ...newRow[0], defaultPassword: email.split("@")[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ message: "Email or staff number already exists" });
    next(err);
  }
});

router.put("/:id", requireRoles("admin","hr"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { firstName, lastName, email, phone, staffNumber, tscStaffId,
            department, qualification, hireDate, status } = req.body;
    const { rowCount } = await pgPool.query(
      `UPDATE teachers SET first_name=$1, last_name=$2, email=$3, phone=$4,
      staff_number=$5, tsc_staff_id=$6, department=$7, qualification=$8, hire_date=$9, status=$10,
      updated_at=CURRENT_TIMESTAMP
      WHERE teacher_id=$11 AND school_id=$12 AND is_deleted=false`,
      [firstName, lastName, email, phone||null, staffNumber||null, tscStaffId||null,
        department||null, qualification||null, hireDate||null, status||"active",
        req.params.id, schoolId]
    );
    if (!rowCount) return res.status(404).json({ message: "Teacher not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pgPool.query(
      `UPDATE teachers SET is_deleted=true, updated_at=CURRENT_TIMESTAMP
      WHERE teacher_id=$1 AND school_id=$2`,
      [req.params.id, schoolId]
    );
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;