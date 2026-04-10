import { Router } from "express";
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
      .select('fee_structure_id, class_name, term, tuition, activity, misc, created_at')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
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
    const { 
      classId, 
      term, 
      academicYear, 
      isActive = 1,
      tuition = 0,
      activity = 0,
      misc = 0,
      transport = 0
    } = req.body;
    
    if (!classId || !term || !academicYear) {
      return res.status(400).json({ message: "classId, term and academicYear required" });
    }
    
    // Kenyan school fee validation (minimum amounts)
    const totalFees = Number(tuition || 0) + Number(activity || 0) + Number(misc || 0) + Number(transport || 0);
    if (totalFees < 500) {
      return res.status(400).json({ 
        message: "Total fees must be at least KES 500 for Kenyan schools" 
      });
    }
    
    if (totalFees > 200000) {
      return res.status(400).json({ 
        message: "Total fees exceed reasonable limit for Kenyan schools (KES 200,000)" 
      });
    }
    const { data: inserted, error } = await supabase
      .from('fee_structures')
      .insert({
        school_id: schoolId,
        class_id: classId,
        term,
        academic_year: academicYear,
        tuition: Number(tuition || 0),
        activity: Number(activity || 0),
        misc: Number(misc || 0),
        transport: Number(transport || 0),
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