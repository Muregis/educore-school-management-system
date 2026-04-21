import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { logActivity } from "../helpers/activity.logger.js";
import { requireRoles } from "../middleware/roles.js";
import multer from "multer";

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for photos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

const router = Router();
router.use(authRequired);

function normalizeAdmissionNumber(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePhoneNumber(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizeDateInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // Accept ISO dates directly.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // Accept common spreadsheet exports like 14/09/2010 or 14-09-2010.
  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, dayStr, monthStr, yearStr] = match;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);
    const candidate = new Date(Date.UTC(year, month - 1, day));

    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      return `${yearStr}-${monthStr.padStart(2, "0")}-${dayStr.padStart(2, "0")}`;
    }
  }

  throw Object.assign(new Error(`Invalid date format: ${raw}. Use YYYY-MM-DD or DD/MM/YYYY.`), {
    statusCode: 400,
  });
}

// ─── GET / — list all students for this school ────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: rows, error } = await supabase
      .from('students')
      .select(
        'student_id, admission_number, first_name, last_name, gender, class_id, class_name, status, date_of_birth, nemis_number, phone, email, address, parent_name, parent_phone, blood_group, allergies, medical_conditions, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, admission_date, photo_url, created_at'
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
      parentPhone = null, bloodGroup = null, allergies = null, medicalConditions = null,
      emergencyContactName = null, emergencyContactPhone = null, emergencyContactRelationship = null,
      email = null, address = null, photoUrl = null,
      admissionDate = null, status = "active"
    } = req.body;
    
    console.log('[DEBUG] POST /students req.body:', req.body);

    const normalizedAdmissionNumber = normalizeAdmissionNumber(admissionNumber);
    const normalizedDateOfBirth = normalizeDateInput(dateOfBirth);
    const normalizedAdmissionDate = normalizeDateInput(admissionDate) || new Date().toISOString().slice(0, 10);
    const normalizedPhone = normalizePhoneNumber(phone);
    const normalizedParentPhone = normalizePhoneNumber(parentPhone);

    if (!normalizedAdmissionNumber || !firstName || !lastName || !gender)
      return res.status(400).json({ message: "admissionNumber, firstName, lastName, gender are required" });

    // Kenyan phone number validation (supports: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, +2541xxxxxxxx)
    const phoneRegex = /^(\+?254|0)[17][0-9]{8}$/;
    if (normalizedPhone && !phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({ 
        message: "Invalid Kenyan phone number format. Use: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, or +2541xxxxxxxx" 
      });
    }
    
    if (normalizedParentPhone && !phoneRegex.test(normalizedParentPhone)) {
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

    const { data: existing } = await supabase
      .from('students')
      .select('student_id')
      .eq('school_id', schoolId)
      .ilike('admission_number', normalizedAdmissionNumber)
      .eq('is_deleted', false)
      .limit(1);
    if (existing?.length) {
      return res.status(409).json({ message: "Admission number already exists" });
    }

    console.log('[DEBUG] Inserting student with class_name:', resolvedClassName, 'parent_name:', parentName, 'parent_phone:', parentPhone);
    
    const { data: result, error } = await supabase
      .from('students')
      .insert({
        school_id: schoolId,
        class_id: resolvedClassId,
        class_name: resolvedClassName,
        admission_number: normalizedAdmissionNumber,
        first_name: firstName,
        last_name: lastName,
        gender,
        date_of_birth: normalizedDateOfBirth,
        nemis_number: nemisNumber,
        phone: normalizedPhone,
        email,
        address,
        parent_name: parentName,
        parent_phone: normalizedParentPhone,
        blood_group: bloodGroup,
        allergies: allergies,
        medical_conditions: medicalConditions,
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
        emergency_contact_relationship: emergencyContactRelationship,
        photo_url: photoUrl,
        admission_date: normalizedAdmissionDate,
        status,
      })
      .select()
      .single();

    if (error) throw error;
    console.log('[DEBUG] Insert result:', result);
    const studentId = result.student_id;

    // Auto-create portal accounts (login: admissionNumber, pass: admissionNumber)
    try {
      const hash = await bcrypt.hash(normalizedAdmissionNumber, 10);
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
            email: `${normalizedAdmissionNumber.toLowerCase()}.student@portal`,
            password_hash: hash,
            role: 'student',
            status: 'active',
          },
          {
            school_id: schoolId,
            student_id: studentId,
            full_name: parentDisplayName,
            email: `${normalizedAdmissionNumber.toLowerCase()}.parent@portal`,
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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
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
      admissionNumber, firstName, lastName, gender, className, classId,
      dateOfBirth, nemisNumber, phone, parentName, parentPhone,
      bloodGroup, allergies, medicalConditions, emergencyContactName, emergencyContactPhone, emergencyContactRelationship,
      email, address, photoUrl, status
    } = req.body;

    const normalizedDateOfBirth = normalizeDateInput(dateOfBirth);
    const normalizedPhone = normalizePhoneNumber(phone);
    const normalizedParentPhone = normalizePhoneNumber(parentPhone);

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

    const normalizedAdmissionNumber = admissionNumber ? normalizeAdmissionNumber(admissionNumber) : null;

    // Check for duplicate if admission number is being changed
    if (normalizedAdmissionNumber) {
      const { data: existing } = await supabase
        .from('students')
        .select('student_id')
        .eq('school_id', schoolId)
        .ilike('admission_number', normalizedAdmissionNumber)
        .neq('student_id', req.params.id)
        .eq('is_deleted', false)
        .limit(1);
      if (existing?.length) {
        return res.status(409).json({ message: "Admission number already exists" });
      }
    }

    const { data: updated, error } = await supabase
      .from('students')
      .update({
        ...(normalizedAdmissionNumber && { admission_number: normalizedAdmissionNumber }),
        first_name: firstName,
        last_name: lastName,
        gender,
        class_id: resolvedClassId,
        class_name: className || null,
        date_of_birth: normalizedDateOfBirth,
        nemis_number: nemisNumber || null,
        phone: normalizedPhone,
        email: email || null,
        address: address || null,
        parent_name: parentName || null,
        parent_phone: normalizedParentPhone,
        blood_group: bloodGroup || null,
        allergies: allergies || null,
        medical_conditions: medicalConditions || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        emergency_contact_relationship: emergencyContactRelationship || null,
        photo_url: photoUrl || null,
        status: status || 'active',
      })
      .eq('student_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('student_id')
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Student not found" });

    // Update portal account emails if admission number changed
    if (normalizedAdmissionNumber) {
      try {
        await supabase
          .from('users')
          .update({ 
            email: `${normalizedAdmissionNumber.toLowerCase()}.student@portal`,
            full_name: `${firstName} ${lastName}`
          })
          .eq('student_id', req.params.id)
          .eq('school_id', schoolId)
          .eq('role', 'student');
        
        await supabase
          .from('users')
          .update({ 
            email: `${normalizedAdmissionNumber.toLowerCase()}.parent@portal`
          })
          .eq('student_id', req.params.id)
          .eq('school_id', schoolId)
          .eq('role', 'parent');
      } catch (userUpdateErr) {
        console.log('[WARN] Failed to update portal accounts:', userUpdateErr);
        // Don't fail the whole request if user update fails
      }
    }

    logActivity(req, { action: "student.update", entity: "student", entityId: req.params.id, description: `Student updated: ${firstName} ${lastName}` });
    res.json({ updated: true });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
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

// ─── POST /upload-photo — upload student photo ─────────────────────────────
router.post("/upload-photo", requireRoles("admin", "teacher"), upload.single('file'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    // Verify student belongs to this school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, first_name, last_name')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const file = req.file;
    const timestamp = Date.now();
    const fileExt = file.originalname.split('.').pop();
    const filename = `student-photo-${studentId}-${timestamp}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('student-photos')
      .getPublicUrl(filename);

    // Update student's photo_url
    const { error: updateError } = await supabase
      .from('students')
      .update({ photo_url: publicUrl })
      .eq('student_id', studentId)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;

    logActivity(req, {
      action: "student.photo_uploaded",
      entity: "student",
      entityId: studentId,
      description: `Photo uploaded for student ${student.first_name} ${student.last_name}`
    });

    res.json({
      photoUrl: publicUrl,
      filename: filename
    });

  } catch (err) {
    next(err);
  }
});

export default router;
