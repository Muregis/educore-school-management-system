import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { logActivity } from "../helpers/activity.logger.js";
import { requireRoles, requireDirector } from "../middleware/roles.js";
import { authorize } from "../middleware/permissions.js";
import { PromotionService } from "../services/backend_services.js";
import { studentDataRateLimit } from "../middleware/rateLimit.js";
import multer from "multer";
import { getTeacherAssignedClasses } from "../utils/getTeacherClasses.js";
import { getPortalStudentIds, requirePortalStudentAccess } from "../utils/portalAccess.js";

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

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

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;

    let query = supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    // Teachers only see assigned classes
    if (role === 'teacher') {
      const assignedClasses = await getTeacherAssignedClasses(schoolId, userId);
      
      if (assignedClasses.length === 0) {
        return res.json([]);
      }

      query = query.in('class_name', assignedClasses);
    }

    if (role === "parent" || role === "student") {
      const portalStudentIds = await getPortalStudentIds(req, supabase);
      if (!portalStudentIds.length) return res.json([]);
      query = query.in("student_id", portalStudentIds);
    }

    // Execute query
    const { data: rows, error } = await query
      .order('class_name')
      .order('first_name');

    if (error) throw error;

    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

// ─── GET /promotion-eligible - Get promotion-eligible students ─────────────────
router.get("/promotion-eligible", authorize("promotion.view"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.query;

    let query = supabase
      .from('student_enrollments')
      .select(`
        enrollment_id,
        enrollment_date,
        status,
        students:student_id(
          student_id,
          first_name,
          last_name,
          admission_number,
          class_name
        ),
        classes:class_id(class_name)
      `)
      .eq('is_current', true)
      .eq('status', 'active');

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Error fetching promotion-eligible students:', err);
    res.status(500).json({ message: "Failed to fetch promotion-eligible students" });
  }
});

// ─── POST /bulk-promote - Bulk promote students ───────────────────────────────
router.post("/bulk-promote", authorize("promotion.approve"), async (req, res, next) => {
  try {
    const { studentIds, toClassId, reason } = req.body;
    const { user_id } = req.user;

    const results = [];
    for (const studentId of studentIds) {
      try {
        const result = await PromotionService.promoteStudent(studentId, toClassId, user_id, reason);
        results.push({ studentId, success: true, result });
      } catch (error) {
        results.push({ studentId, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('Error bulk promoting students:', err);
    res.status(500).json({ message: err.message || "Failed to bulk promote students" });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const canAccess = await requirePortalStudentAccess(req, supabase, req.params.id);
    if (!canAccess) return res.status(403).json({ message: "Forbidden" });

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

// ─── POST / ───────────────────────────────────────────────────────────────────
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

    const normalizedAdmissionNumber = admissionNumber ? normalizeAdmissionNumber(admissionNumber) : null;
    const normalizedDateOfBirth = normalizeDateInput(dateOfBirth);
    const normalizedAdmissionDate = normalizeDateInput(admissionDate) || new Date().toISOString().slice(0, 10);
    const normalizedPhone = normalizePhoneNumber(phone);
    const normalizedParentPhone = normalizePhoneNumber(parentPhone);

    if (!firstName || !lastName || !gender)
      return res.status(400).json({ message: "firstName, lastName, gender are required" });

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
        console.log('[DEBUG] Class lookup failed for:', className);
      }
    }

    let finalAdmissionNumber = normalizedAdmissionNumber;
    if (!finalAdmissionNumber) {
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      finalAdmissionNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`;
    } else {
      const { data: existing } = await supabase
        .from('students')
        .select('student_id')
        .eq('school_id', schoolId)
        .ilike('admission_number', finalAdmissionNumber)
        .eq('is_deleted', false)
        .limit(1);
      if (existing?.length) {
        return res.status(409).json({ message: "Admission number already exists" });
      }
    }

    const { data: result, error } = await supabase
      .from('students')
      .insert({
        school_id: schoolId,
        class_id: resolvedClassId,
        class_name: resolvedClassName,
        admission_number: finalAdmissionNumber,
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
        allergies,
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
    const studentId = result.student_id;

    try {
      const hash = await bcrypt.hash(finalAdmissionNumber, 10);
      const parentDisplayName = parentName?.trim() || `Parent of ${firstName} ${lastName}`;
      await supabase
        .from('users')
        .insert([
          {
            school_id: schoolId,
            student_id: studentId,
            full_name: `${firstName} ${lastName}`,
            email: `${finalAdmissionNumber.toLowerCase()}.student@portal`,
            password_hash: hash,
            role: 'student',
            status: 'active',
          },
          {
            school_id: schoolId,
            student_id: studentId,
            full_name: parentDisplayName,
            email: `${finalAdmissionNumber.toLowerCase()}.parent@portal`,
            password_hash: hash,
            role: 'parent',
            status: 'active',
          },
        ]);
    } catch { /* ignore if account already exists */ }

    const { data: newRow, error: fetchError } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .limit(1)
      .single();

    if (fetchError) console.log('[DEBUG] Fetch error:', fetchError);

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

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      firstName, lastName, gender, className, classId,
      dateOfBirth, nemisNumber, phone, parentName, parentPhone,
      bloodGroup, allergies, medicalConditions,
      emergencyContactName, emergencyContactPhone, emergencyContactRelationship,
      email, address, photoUrl, status,
    } = req.body;

    const normalizedDateOfBirth = normalizeDateInput(dateOfBirth);
    const normalizedPhone = normalizePhoneNumber(phone);
    const normalizedParentPhone = normalizePhoneNumber(parentPhone);

    const { data: currentStudent, error: currentError } = await supabase
      .from('students')
      .select('student_id, admission_number')
      .eq('student_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (currentError || !currentStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

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
        console.log('[DEBUG] Class lookup failed for:', className);
      }
    }

    const updateData = {
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
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('student_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('student_id')
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Student not found" });

    logActivity(req, { action: "student.update", entity: "student", entityId: req.params.id, description: `Student updated: ${firstName} ${lastName}` });
    res.json({ updated: true });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete("/:id", requireRoles("admin"), requireDirector(), async (req, res, next) => {
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

// ─── POST /upload-photo ───────────────────────────────────────────────────────
router.post("/upload-photo", requireRoles("admin", "teacher", "director", "superadmin"), upload.single('file'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ message: "Student ID is required" });

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

    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('student-photos')
      .getPublicUrl(filename);

    await supabase
      .from('students')
      .update({ photo_url: publicUrl })
      .eq('student_id', studentId)
      .eq('school_id', schoolId);

    logActivity(req, {
      action: "student.photo_uploaded",
      entity: "student",
      entityId: studentId,
      description: `Photo uploaded for student ${student.first_name} ${student.last_name}`
    });

    res.json({ photoUrl: publicUrl, filename });
  } catch (err) { next(err); }
});

// ─── PATCH /:id/fees ──────────────────────────────────────────────────────────
router.patch("/:id/fees", requireRoles("admin", "finance", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      outstanding_balance, transport_fee, lunch_fee, breakfast_fee,
      opening_balance, opening_balance_type, transport_direction, transport_base_fee,
      lunch_enabled, lunch_daily_rate, lunch_days, lunch_billing_type,
      breakfast_enabled, breakfast_daily_rate, breakfast_days, breakfast_billing_type,
      discount_type, discount_value, discount_is_percentage,
    } = req.body;

    const updateData = { updated_at: new Date().toISOString() };

    if (outstanding_balance !== undefined) updateData.outstanding_balance = parseFloat(outstanding_balance) || 0;
    if (transport_fee !== undefined) updateData.transport_fee = parseFloat(transport_fee) || 0;
    if (lunch_fee !== undefined) updateData.lunch_fee = parseFloat(lunch_fee) || 0;
    if (breakfast_fee !== undefined) updateData.breakfast_fee = parseFloat(breakfast_fee) || 0;
    if (opening_balance !== undefined) updateData.opening_balance = parseFloat(opening_balance) || 0;
    if (opening_balance_type !== undefined) updateData.opening_balance_type = opening_balance_type || "owing";
    if (transport_direction !== undefined) updateData.transport_direction = transport_direction || "none";
    if (transport_base_fee !== undefined) updateData.transport_base_fee = parseFloat(transport_base_fee) || 0;
    if (lunch_enabled !== undefined) updateData.lunch_enabled = Boolean(lunch_enabled);
    if (lunch_daily_rate !== undefined) updateData.lunch_daily_rate = parseFloat(lunch_daily_rate) || 0;
    if (lunch_days !== undefined) updateData.lunch_days = parseInt(lunch_days, 10) || 0;
    if (lunch_billing_type !== undefined) updateData.lunch_billing_type = lunch_billing_type || "daily";
    if (breakfast_enabled !== undefined) updateData.breakfast_enabled = Boolean(breakfast_enabled);
    if (breakfast_daily_rate !== undefined) updateData.breakfast_daily_rate = parseFloat(breakfast_daily_rate) || 0;
    if (breakfast_days !== undefined) updateData.breakfast_days = parseInt(breakfast_days, 10) || 0;
    if (breakfast_billing_type !== undefined) updateData.breakfast_billing_type = breakfast_billing_type || "daily";
    if (discount_type !== undefined) updateData.discount_type = discount_type || null;
    if (discount_value !== undefined) updateData.discount_value = parseFloat(discount_value) || 0;
    if (discount_is_percentage !== undefined) updateData.discount_is_percentage = Boolean(discount_is_percentage);

    const { data, error } = await supabase
      .from("students")
      .update(updateData)
      .eq('student_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('student_id')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Student not found" });

    res.json({ success: true, student_id: data.student_id });
  } catch (err) { next(err); }
});

// ─── GET /:studentId/ledger ───────────────────────────────────────────────────
router.get("/:studentId/ledger", studentDataRateLimit, requireRoles("director", "admin", "finance", "staff", "parent", "student"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const canAccess = await requirePortalStudentAccess(req, supabase, studentId);
    if (!canAccess) return res.status(403).json({ message: "Forbidden" });
    const { limit = 50, offset = 0, term, academic_year } = req.query;

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, admission_number')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentError || !student) return res.status(404).json({ message: "Student not found" });

    let query = supabase
      .from('student_ledger')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (term) query = query.eq('term', term);
    if (academic_year) query = query.eq('academic_year', academic_year);

    const { data: ledger, error: ledgerError } = await query
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (ledgerError) throw ledgerError;

    res.json({
      student: {
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        admission_number: student.admission_number
      },
      ledger: ledger || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (ledger || []).length === parseInt(limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:studentId/invoices ─────────────────────────────────────────────────
router.get("/:studentId/invoices", studentDataRateLimit, requireRoles("director", "admin", "finance", "staff", "parent", "student"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const canAccess = await requirePortalStudentAccess(req, supabase, studentId);
    if (!canAccess) return res.status(403).json({ message: "Forbidden" });
    const { limit = 50, offset = 0, term, academic_year } = req.query;

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, admission_number')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentError || !student) return res.status(404).json({ message: "Student not found" });

    let query = supabase
      .from('invoices')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (term) query = query.eq('term', term);
    if (academic_year) query = query.eq('academic_year', academic_year);

    const { data: invoices, error: invoicesError } = await query
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (invoicesError) throw invoicesError;

    res.json({
      student: {
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        admission_number: student.admission_number
      },
      invoices: invoices || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (invoices || []).length === parseInt(limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
