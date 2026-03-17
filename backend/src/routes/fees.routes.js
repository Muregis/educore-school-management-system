import { Router } from "express";
// OLD: import { pool } from "../config/db.js";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";

// simple CRUD for fee_structures (per class, term, year)
const router = Router();
router.use(authRequired);

// list fee structures
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: rows, error } = await supabase
      .from('fee_structures')
      .select('fee_structure_id, class_id, term, academic_year, is_active, created_at')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('academic_year', { ascending: false });
    if (error) throw error;
    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

// get single structure
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: row, error } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('fee_structure_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();
    if (error || !row) return res.status(404).json({ message: "Structure not found" });
    res.json(row);
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
    const { data: inserted, error } = await supabase
      .from('fee_structures')
      .insert({
        school_id: schoolId,
        class_id: classId,
        term,
        academic_year: academicYear,
        is_active: isActive
      })
      .select('fee_structure_id')
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: "Structure already exists for class/term/year" });
      }
      throw error;
    }
    res.status(201).json({ feeStructureId: inserted.fee_structure_id });
  } catch (err) {
    next(err);
  }
});

// update
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId, term, academicYear, isActive } = req.body;
    const { data: updated, error } = await supabase
      .from('fee_structures')
      .update({
        class_id: classId,
        term,
        academic_year: academicYear,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('fee_structure_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('fee_structure_id')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Structure not found" });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// soft delete
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: updated, error } = await supabase
      .from('fee_structures')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('fee_structure_id', req.params.id)
      .eq('school_id', schoolId)
      .select('fee_structure_id')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Structure not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;