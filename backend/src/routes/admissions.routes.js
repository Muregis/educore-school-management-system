import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// GET all applications
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.query;
    let q = supabase
      .from('admissions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (status) {
      q = q.eq('status', status);
    }
    const { data: rows, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(rows || []);
  } catch (err) { next(err); }
});

// POST new application
router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { fullName, dateOfBirth, gender, parentName, parentPhone, parentEmail, address, previousSchool, applyingClass, academicYear = "2026", notes } = req.body;
    if (!fullName || !applyingClass) return res.status(400).json({ message: "fullName and applyingClass are required" });
    const { data: inserted, error } = await supabase
      .from('admissions')
      .insert({
        school_id: schoolId,
        full_name: fullName,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        parent_name: parentName || null,
        parent_phone: parentPhone || null,
        parent_email: parentEmail || null,
        address: address || null,
        previous_school: previousSchool || null,
        applying_class: applyingClass,
        academic_year: academicYear,
        notes: notes || null
      })
      .select('admission_id')
      .single();
    if (error) throw error;
    res.status(201).json({ admissionId: inserted.admission_id });
  } catch (err) { next(err); }
});

// PATCH update status
router.patch("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, notes } = req.body;
    const { data: existing, error: fetchError } = await supabase
      .from('admissions')
      .select('notes')
      .eq('admission_id', req.params.id)
      .eq('school_id', schoolId)
      .single();
    if (fetchError) throw fetchError;
    
    const { error } = await supabase
      .from('admissions')
      .update({
        status,
        notes: notes || existing.notes,
        updated_at: new Date().toISOString()
      })
      .eq('admission_id', req.params.id)
      .eq('school_id', schoolId);
    if (error) throw error;
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// DELETE
router.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { error } = await supabase
      .from('admissions')
      .update({ is_deleted: true })
      .eq('admission_id', req.params.id)
      .eq('school_id', schoolId);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
