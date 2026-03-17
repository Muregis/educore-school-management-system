import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// ─── GET / — list attendance records (already Supabase, unchanged) ────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId, date, from, to, studentId } = req.query;

    let query = supabase
      .from('attendance')
      .select(`
        attendance_id,
        student_id,
        attendance_date,
        status,
        class_id,
        students!inner(
          student_id,
          first_name,
          last_name,
          admission_number,
          class_name
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (classId)   { query = query.eq('class_id', classId); }
    if (studentId) { query = query.eq('student_id', studentId); }
    if (date)      { query = query.eq('attendance_date', date); }
    if (from)      { query = query.gte('attendance_date', from); }
    if (to)        { query = query.lte('attendance_date', to); }

    query = query
      .order('attendance_date', { ascending: false })
      .order('attendance_id',   { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const transformedData = data?.map(item => ({
      attendance_id:   item.attendance_id,
      student_id:      item.student_id,
      student_name:    `${item.students.first_name} ${item.students.last_name}`,
      admission_number: item.students.admission_number,
      class_name:      item.students.class_name,
      attendance_date: item.attendance_date,
      status:          item.status,
      class_id:        item.class_id,
    })) || [];

    res.json(transformedData);
  } catch (err) { next(err); }
});

// ── Helper: resolve classId from numeric ID or class_name string ──────────────
async function resolveClassId(schoolId, classId) {
  if (!isNaN(Number(classId)) && Number(classId) > 0) return Number(classId);

  const { data: cls } = await supabase
    .from('classes')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('class_name', classId)
    .eq('is_deleted', false)
    .limit(1)
    .single();
  if (cls) return cls.class_id;

  // Auto-create placeholder class so FK is satisfied
  const { data: result } = await supabase
    .from('classes')
    .insert({
      school_id:     schoolId,
      class_name:    classId,
      academic_year: new Date().getFullYear(),
      status:        'active',
    })
    .select('class_id')
    .single();
  return result.class_id;
}

// ─── POST /bulk — save full class attendance for a date ───────────────────────
router.post("/bulk", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records) || !records.length)
      return res.status(400).json({ message: "classId, date and records array are required" });

    const resolvedClassId = await resolveClassId(schoolId, classId);

    // Soft-delete existing records for this class + date instead of hard DELETE
    const { error: delError } = await supabase
      .from('attendance')
      .update({ is_deleted: true })
      .eq('school_id', schoolId)
      .eq('class_id', resolvedClassId)
      .eq('attendance_date', date);
    if (delError) throw delError;

    // Build insert payload
    const rows = records.map(r => ({
      school_id:          schoolId,
      student_id:         r.studentId ?? r.student_id,
      class_id:           resolvedClassId,
      attendance_date:    date,
      status:             r.status || 'present',
      marked_by_user_id:  userId || null,
      is_deleted:         false,
    }));

    const { error: insError } = await supabase
      .from('attendance')
      .insert(rows);
    if (insError) throw insError;

    res.status(201).json({ saved: records.length });
  } catch (err) { next(err); }
});

// ─── POST / — single attendance record (upsert) ───────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { studentId, classId, date, status = "present" } = req.body;

    if (!studentId || !classId || !date)
      return res.status(400).json({ message: "studentId, classId and date are required" });

    const resolvedClassId = await resolveClassId(schoolId, classId);

    const { error } = await supabase
      .from('attendance')
      .upsert(
        {
          school_id:         schoolId,
          student_id:        studentId,
          class_id:          resolvedClassId,
          attendance_date:   date,
          status,
          marked_by_user_id: userId || null,
          is_deleted:        false,
        },
        { onConflict: 'school_id,student_id,class_id,attendance_date' }
      );
    if (error) throw error;

    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

// ─── PUT /:id — update a single attendance record ────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, date } = req.body;

    const { data: updated, error } = await supabase
      .from('attendance')
      .update({ status, attendance_date: date })
      .eq('attendance_id', req.params.id)
      .eq('school_id', schoolId)
      .select('attendance_id')
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Record not found" });

    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE /:id — soft delete attendance record ──────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error } = await supabase
      .from('attendance')
      .update({ is_deleted: true })
      .eq('attendance_id', req.params.id)
      .eq('school_id', schoolId);
    if (error) throw error;

    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
