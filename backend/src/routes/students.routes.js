import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { logActivity } from "../helpers/activity.logger.js";
import { requireRoles } from "../middleware/roles.js";
// OLD: import { pool } from "../config/db.js";
// OLD: import { pgPool } from "../config/pg.js";

const router = Router();
router.use(authRequired);

// OLD: const usePgStudentsGet =
// OLD:   String(process.env.USE_PG_STUDENTS_GET || "").toLowerCase() === "true";

// ─── GET / — list all students for this school ────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    // OLD: if (usePgStudentsGet) {
    // OLD:   const { rows } = await pgPool.query(
    // OLD:     `SELECT s.student_id, ... FROM students s WHERE s.school_id=$1 AND s.is_deleted=false ORDER BY s.class_name, s.first_name`,
    // OLD:     [schoolId]
    // OLD:   );
    // OLD:   return res.json(rows);
    // OLD: }
    // OLD: const [rows] = await pool.query(
    // OLD:   `SELECT s.student_id, ... FROM students s WHERE s.school_id=$1 AND s.is_deleted=false ORDER BY s.class_name, s.first_name`,
    // OLD:   [schoolId]
    // OLD: );
    // OLD: res.json(rows);

    const { data: rows, error } = await supabase
      .from('students')
      .select(
        'student_id, admission_number, first_name, last_name, gender, class_id, class_name, status, date_of_birth, phone, email, parent_name, parent_phone, admission_date, created_at'
      )
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('class_name')
      .order('first_name');

    if (error) throw error;
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
      classId = null, dateOfBirth = null, phone = null, parentName = null,
      parentPhone = null, email = null, address = null,
      admissionDate = null, status = "active"
    } = req.body;

    if (!admissionNumber || !firstName || !lastName || !gender)
      return res.status(400).json({ message: "admissionNumber, firstName, lastName, gender are required" });

    // Resolve classId from className if not provided
    let resolvedClassId = classId;
    const resolvedClassName = className || null;
    if (className && !classId) {
      const { data: cls } = await supabase
        .from('classes')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('class_name', className)
        .limit(1)
        .single();
      if (cls) resolvedClassId = cls.class_id;
    }

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
    const studentId = result.student_id;

    // Auto-create student portal account (login: admissionNumber, pass: admissionNumber)
    try {
      const hash = await bcrypt.hash(admissionNumber, 10);
      await supabase
        .from('users')
        .upsert(
          {
            school_id: schoolId,
            student_id: studentId,
            full_name: `${firstName} ${lastName}`,
            email: admissionNumber,
            password_hash: hash,
            role: 'student',
            status: 'active',
          },
          { onConflict: 'school_id,student_id' }
        );
    } catch { /* ignore if account already exists */ }

    // Return the full new student row so frontend can update state correctly
    const { data: newRow } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .limit(1)
      .single();

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
      dateOfBirth, phone, parentName, parentPhone, email, address, status
    } = req.body;

    // OLD: let resolvedClassId = classId || null;
    // OLD: if (className && !classId) {
    // OLD:   const { rows } = await pool.query(
    // OLD:     `SELECT class_id FROM classes WHERE school_id=$1 AND class_name=$2 LIMIT 1`,
    // OLD:     [schoolId, className]
    // OLD:   );
    // OLD:   if (rows.length) resolvedClassId = rows[0].class_id;
    // OLD: }
    let resolvedClassId = classId || null;
    if (className && !classId) {
      const { data: cls } = await supabase
        .from('classes')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('class_name', className)
        .limit(1)
        .single();
      if (cls) resolvedClassId = cls.class_id;
    }

    // OLD: const { rows } = await pool.query(
    // OLD:   `UPDATE students SET first_name=$1, last_name=$2, gender=$3, class_id=$4, class_name=$5,
    // OLD:   date_of_birth=$6, phone=$7, email=$8, address=$9, parent_name=$10, parent_phone=$11,
    // OLD:   status=$12, updated_at=CURRENT_TIMESTAMP
    // OLD:   WHERE student_id=$13 AND school_id=$14 AND is_deleted=false`,
    // OLD:   [firstName, lastName, gender, resolvedClassId, className||null,
    // OLD:   dateOfBirth||null, phone||null, email||null, address||null,
    // OLD:   parentName||null, parentPhone||null, status||"active",
    // OLD:   req.params.id, schoolId]
    // OLD: );
    // OLD: if (!rows.length) return res.status(404).json({ message: "Student not found" });
    const { data: updated, error } = await supabase
      .from('students')
      .update({
        first_name: firstName,
        last_name: lastName,
        gender,
        class_id: resolvedClassId,
        class_name: className || null,
        date_of_birth: dateOfBirth || null,
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

    // OLD: const { rows } = await pool.query(
    // OLD:   `UPDATE students SET is_deleted=true, updated_at=CURRENT_TIMESTAMP
    // OLD:   WHERE student_id=$1 AND school_id=$2`,
    // OLD:   [req.params.id, schoolId]
    // OLD: );
    // OLD: if (!rows.length) return res.status(404).json({ message: "Student not found" });
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
