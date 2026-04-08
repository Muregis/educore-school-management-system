import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { logActivity } from "../helpers/activity.logger.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// ─── GET / — list all students for this school ────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: rows, error } = await supabase
      .from('students')
      .select(
        'student_id, admission_number, first_name, last_name, gender, class_id, class_name, status, date_of_birth, nemis_number, phone, email, parent_name, parent_phone, admission_date, created_at'
      )
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('class_name')
      .order('first_name');

    if (error) throw error;
    console.log('[DEBUG] GET students first row:', rows?.[0]);
    res.json(rows || []);
  } catch (err) { next(err); }
});

// ─── GET /:id — single student ────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .limit(1)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Student not found" });
    res.json(data);
  } catch (err) { next(err); }
});

// ─── POST / — admit new student ───────────────────────────────────────────────
router.post("/", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      admissionNumber, firstName, lastName, gender, className,
      classId = null, dateOfBirth = null, nemisNumber = null, phone = null, parentName = null,
      parentPhone = null, email = null, address = null,
      admissionDate = null, status = "active"
    } = req.body;
    
    console.log('[DEBUG] POST /students req.body:', req.body);

    if (!admissionNumber || !firstName || !lastName || !gender)
      return res.status(400).json({ message: "admissionNumber, firstName, lastName, gender are required" });

    // Kenyan phone number validation (supports: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, +2541xxxxxxxx)
    const phoneRegex = /^(\+?254|0)[17][0-9]{8}$/;
    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({ 
        message: "Invalid Kenyan phone number format. Use: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, or +2541xxxxxxxx" 
      });
    }
    
    if (parentPhone && !phoneRegex.test(parentPhone)) {
      return res.status(400).json({ 
        message: "Invalid Kenyan parent phone number format. Use: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, or +2541xxxxxxxx" 
      });
    }

    // Resolve classId from className if not provided
    let resolvedClassId = classId;
    const resolvedClassName = className || null;
    if (className && !classId) {
      try {
        const { data: cls } = await supabase
          .from('classes')
          .select('class_id')
          .eq('school_id', schoolId)
          .eq('class_name', className)
          .maybeSingle();
        if (cls) resolvedClassId = cls.class_id;
      } catch (clsErr) {
        // Class lookup failed, but we can still save with null class_id
        console.log('[DEBUG] Class lookup failed for:', className, '- saving with null class_id');
      }
    }

    console.log('[DEBUG] Inserting student with class_name:', resolvedClassName, 'parent_name:', parentName, 'parent_phone:', parentPhone);
    
    const { data: result, error } = await supabase
      .from('students')
      .insert({
        school_id: schoolId,
        class_id: resolvedClassId,
        class_name: resolvedClassName,
        admission_number: admissionNumber,
        first_name: firstName,
        last_name: lastName,
        gender,
        date_of_birth: dateOfBirth,
        nemis_number: nemisNumber,
        phone,
        email,
        address,
        parent_name: parentName,
        parent_phone: parentPhone,
        admission_date: admissionDate || new Date().toISOString().slice(0, 10),
        status,
      })
      .select()
      .single();

    if (error) throw error;
    console.log('[DEBUG] Insert result:', result);
    const studentId = result.student_id;

    // Auto-create portal accounts (login: admissionNumber, pass: admissionNumber)
    try {
      const hash = await bcrypt.hash(admissionNumber, 10);
      const parentDisplayName = parentName?.trim() || `Parent of ${firstName} ${lastName}`;
      // OLD: await supabase
      // OLD:   .from('users')
      // OLD:   .upsert(
      // OLD:     {
      // OLD:       school_id: schoolId,
      // OLD:       student_id: studentId,
      // OLD:       full_name: `${firstName} ${lastName}`,
      // OLD:       email: admissionNumber,
      // OLD:       password_hash: hash,
      // OLD:       role: 'student',
      // OLD:       status: 'active',
      // OLD:     },
      // OLD:     { onConflict: 'school_id,student_id' }
      // OLD:   );
      await supabase
        .from('users')
        .insert([
          {
            school_id: schoolId,
            student_id: studentId,
            full_name: `${firstName} ${lastName}`,
            email: `${String(admissionNumber).trim().toLowerCase()}.student@portal`,
            password_hash: hash,
            role: 'student',
            status: 'active',
          },
          {
            school_id: schoolId,
            student_id: studentId,
            full_name: parentDisplayName,
            email: `${String(admissionNumber).trim().toLowerCase()}.parent@portal`,
            password_hash: hash,
            role: 'parent',
            status: 'active',
          },
        ]);
    } catch { /* ignore if account already exists */ }

    // Return the full new student row so frontend can update state correctly
    const { data: newRow, error: fetchError } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .limit(1)
      .single();
    
    if (fetchError) console.log('[DEBUG] Fetch error:', fetchError);
    console.log('[DEBUG] Returning newRow:', newRow);

    logActivity(req, { action: "student.create", entity: "student", entityId: studentId, description: `Student admitted: ${firstName} ${lastName}` });
    res.status(201).json(newRow);
  } catch (err) {
    if (err.code === "23505" || err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Admission number already exists" });
    next(err);
  }
});

// ─── PUT /:id — update student ────────────────────────────────────────────────
router.put("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      firstName, lastName, gender, className, classId,
      dateOfBirth, nemisNumber, phone, parentName, parentPhone, email, address, status
    } = req.body;

    let resolvedClassId = classId || null;
    if (className && !classId) {
      try {
        const { data: cls } = await supabase
          .from('classes')
          .select('class_id')
          .eq('school_id', schoolId)
          .eq('class_name', className)
          .maybeSingle();
        if (cls) resolvedClassId = cls.class_id;
      } catch (clsErr) {
        // Class lookup failed, but we can still update with null class_id
        console.log('[DEBUG] Class lookup failed for:', className, '- updating with null class_id');
      }
    }

    const { data: updated, error } = await supabase
      .from('students')
      .update({
        first_name: firstName,
        last_name: lastName,
        gender,
        class_id: resolvedClassId,
        class_name: className || null,
        date_of_birth: dateOfBirth || null,
        nemis_number: nemisNumber || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        parent_name: parentName || null,
        parent_phone: parentPhone || null,
        status: status || 'active',
      })
      .eq('student_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('student_id')
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Student not found" });

    logActivity(req, { action: "student.update", entity: "student", entityId: req.params.id, description: `Student updated: ${firstName} ${lastName}` });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE /:id — soft delete student ───────────────────────────────────────
router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: deleted, error } = await supabase
      .from('students')
      .update({ is_deleted: true })
      .eq('student_id', req.params.id)
      .eq('school_id', schoolId)
      .select('student_id')
      .single();

    if (error) throw error;
    if (!deleted) return res.status(404).json({ message: "Student not found" });

    logActivity(req, { action: "student.delete", entity: "student", entityId: req.params.id, description: `Student soft-deleted` });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
