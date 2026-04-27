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
    const { fullName, dateOfBirth, gender, parentName, parentPhone, parentEmail, address, previousSchool, applyingClass, academicYear = "2026", notes, autoAccept = false } = req.body;
    if (!fullName || !applyingClass) return res.status(400).json({ message: "fullName and applyingClass are required" });
    
    // Insert admission record
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
        status: autoAccept ? "accepted" : "pending",
        notes: notes || null
      })
      .select('admission_id, status')
      .single();
    if (error) throw error;
    
    let admissionNumber = null;
    let studentId = null;
    
    // If autoAccept is true, create student record immediately
    if (autoAccept) {
      // Generate admission number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);
      
      admissionNumber = `${year}-${String((count || 0) + 1).padStart(4, "0")}`;
      
      // Check for duplicate
      const { data: existing } = await supabase
        .from("students")
        .select("student_id")
        .eq("school_id", schoolId)
        .eq("admission_number", admissionNumber);
      
      if (existing && existing.length > 0) {
        return res.status(409).json({ message: "Admission number generation conflict" });
      }
      
      // Create student
      const nameParts = (fullName || "").trim().split(" ");
      const firstName = nameParts[0] || fullName;
      const lastName = nameParts.slice(1).join(" ") || "";
      
      const { data: student, error: createErr } = await supabase
        .from("students")
        .insert({
          school_id: schoolId,
          admission_number: admissionNumber,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirth || null,
          gender: gender || "unknown",
          parent_name: parentName || null,
          parent_phone: parentPhone || null,
          parent_email: parentEmail || null,
          address: address || null,
          previous_school: previousSchool || null,
          class_name: applyingClass,
          status: "active",
          is_deleted: false
        })
        .select("student_id")
        .single();
      
      if (createErr) throw createErr;
      studentId = student.student_id;
      
      // Update admission with admission number and link
      await supabase
        .from("admissions")
        .update({
          admission_number: admissionNumber,
          updated_at: new Date().toISOString()
        })
        .eq("admission_id", inserted.admission_id);
    }
    
    res.status(201).json({ 
      admissionId: inserted.admission_id,
      admissionNumber: admissionNumber,
      studentId: studentId,
      status: inserted.status
    });
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

// POST /api/admissions/:id/enroll — Accept application AND create student
// Safe: never deletes admission record; creates student additively
router.post("/:id/enroll", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { admissionNumber } = req.body; // optional — auto-generated if blank

    // 1. Fetch the admission (read-only)
    const { data: adm, error: fetchErr } = await supabase
      .from("admissions")
      .select("*")
      .eq("admission_id", req.params.id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .single();
    if (fetchErr || !adm) return res.status(404).json({ message: "Application not found" });
    if (adm.status === "rejected")  return res.status(400).json({ message: "Cannot enroll a rejected application" });

    // 2. Generate admission number if not provided
    //    Format: YYYY-NNNN (e.g. 2026-0047)
    let admNo = admissionNumber?.trim();
    if (!admNo) {
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);
      admNo = `${year}-${String((count || 0) + 1).padStart(4, "0")}`;
    }

    // 3. Check for duplicate admission number
    const { data: existing } = await supabase
      .from("students")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("admission_number", admNo)
      .eq("is_deleted", false)
      .maybeSingle();
    if (existing) return res.status(409).json({ message: `Admission number ${admNo} already exists` });

    // 4. Create student record from admission data
    const nameParts = (adm.full_name || "").trim().split(" ");
    const firstName = nameParts[0] || adm.full_name;
    const lastName  = nameParts.slice(1).join(" ") || "";

    const { data: student, error: createErr } = await supabase
      .from("students")
      .insert({
        school_id:        schoolId,
        admission_number: admNo,
        first_name:       firstName,
        last_name:        lastName,
        date_of_birth:    adm.date_of_birth || null,
        gender:           adm.gender || "unknown",
        parent_name:      adm.parent_name || null,
        parent_phone:     adm.parent_phone || null,
        parent_email:     adm.parent_email || null,
        address:          adm.address || null,
        previous_school:  adm.previous_school || null,
        class_name:       adm.applying_class,
        status:           "active",
        is_deleted:       false,
      })
      .select("student_id")
      .single();
    if (createErr) throw createErr;

    // 5. Mark admission accepted and link to student (additive — does not delete admission)
    await supabase
      .from("admissions")
      .update({
        status:           "accepted",
        admission_number: admNo,
        updated_at:       new Date().toISOString(),
      })
      .eq("admission_id", req.params.id)
      .eq("school_id", schoolId);

    res.status(201).json({
      enrolled:   true,
      student_id: student.student_id,
      admission_number: admNo,
      message: `Student created with admission number ${admNo}`,
    });
  } catch (err) { next(err); }
});

export default router;

