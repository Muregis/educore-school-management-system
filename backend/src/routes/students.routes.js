import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { pgPool } from "../config/pg.js";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { logActivity } from "../helpers/activity.logger.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

const usePgStudentsGet =
  String(process.env.USE_PG_STUDENTS_GET || "").toLowerCase() === "true";

// Always return class_name so frontend normalise() works
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    if (usePgStudentsGet) {
      const { rows } = await pgPool.query(
        `SELECT s.student_id, s.admission_number, s.first_name, s.last_name,
                s.gender, s.class_id, s.class_name, s.status, s.date_of_birth,
                s.phone, s.email, s.parent_name, s.parent_phone, s.admission_date, s.created_at
        FROM students s
        WHERE s.school_id=$1 AND s.is_deleted=false
        ORDER BY s.class_name, s.first_name`,
        [schoolId]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT s.student_id, s.admission_number, s.first_name, s.last_name,
              s.gender, s.class_id, s.class_name, s.status, s.date_of_birth,
              s.phone, s.email, s.parent_name, s.parent_phone, s.admission_date, s.created_at
      FROM students s
      WHERE s.school_id=$1 AND s.is_deleted=false
      ORDER BY s.class_name, s.first_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

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

router.post("/", requireRoles("admin","teacher"), async (req, res, next) => {
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
    let resolvedClassName = className || null;
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
        gender: gender,
        date_of_birth: dateOfBirth,
        phone: phone,
        email: email,
        address: address,
        parent_name: parentName,
        parent_phone: parentPhone,
        admission_date: admissionDate || new Date().toISOString().slice(0,10),
        status: status
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
        .upsert({
          school_id: schoolId,
          student_id: studentId,
          full_name: `${firstName} ${lastName}`,
          email: admissionNumber,
          password_hash: hash,
          role: 'student',
          status: 'active'
        }, {
          onConflict: 'school_id,student_id'
        });
    } catch { /* ignore if account already exists */ }

    // Return the full new student row so frontend can update state correctly
    const { data: newRow } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .limit(1)
      .single();
    
    logActivity(req, { action:"student.create", entity:"student", entityId:studentId, description:`Student admitted: ${req.body.firstName} ${req.body.lastName}` });
    res.status(201).json(newRow);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Admission number already exists" });
    next(err);
  }
});

router.put("/:id", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      firstName, lastName, gender, className, classId,
      dateOfBirth, phone, parentName, parentPhone, email, address, status
    } = req.body;

    let resolvedClassId = classId || null;
    if (className && !classId) {
      const { rows } = await pool.query(
        `SELECT class_id FROM classes WHERE school_id=$1 AND class_name=$2 LIMIT 1`,
        [schoolId, className]
      );
      if (rows.length) resolvedClassId = rows[0].class_id;
    }

    const { rows } = await pool.query(
      `UPDATE students SET first_name=$1, last_name=$2, gender=$3, class_id=$4, class_name=$5,
      date_of_birth=$6, phone=$7, email=$8, address=$9, parent_name=$10, parent_phone=$11,
      status=$12, updated_at=CURRENT_TIMESTAMP
      WHERE student_id=$13 AND school_id=$14 AND is_deleted=false`,
      [firstName, lastName, gender, resolvedClassId, className||null,
      dateOfBirth||null, phone||null, email||null, address||null,
      parentName||null, parentPhone||null, status||"active",
      req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Student not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { rows } = await pool.query(
      `UPDATE students SET is_deleted=true, updated_at=CURRENT_TIMESTAMP
      WHERE student_id=$1 AND school_id=$2`,
      [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Student not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
