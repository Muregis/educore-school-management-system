import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

// simple CRUD for fee_structures (per class, term, year)
const router = Router();
router.use(authRequired);

// list fee structures
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT fee_structure_id, class_id, term, academic_year, is_active, created_at
       FROM fee_structures
       WHERE school_id = ? AND is_deleted = 0
       ORDER BY academic_year DESC, fee_structure_id DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// get single structure
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT * FROM fee_structures WHERE fee_structure_id=? AND school_id=? AND is_deleted=0 LIMIT 1`,
      [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Structure not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// create structure
router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId, term, academicYear, isActive = 1 } = req.body;
    if (!classId || !term || !academicYear) {
      return res.status(400).json({ message: "classId, term and academicYear required" });
    }
    const [result] = await pool.query(
      `INSERT INTO fee_structures (school_id, class_id, term, academic_year, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [schoolId, classId, term, academicYear, isActive]
    );
    res.status(201).json({ feeStructureId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Structure already exists for class/term/year" });
    }
    next(err);
  }
});

// update
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId, term, academicYear, isActive } = req.body;
    const [result] = await pool.query(
      `UPDATE fee_structures SET class_id=?, term=?, academic_year=?, is_active=?, updated_at=CURRENT_TIMESTAMP
       WHERE fee_structure_id=? AND school_id=? AND is_deleted=0`,
      [classId, term, academicYear, isActive, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Structure not found" });
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
      `UPDATE fee_structures SET is_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE fee_structure_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Structure not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;