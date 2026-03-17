import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

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

    query = query.order('attendance_date', { ascending: false })
                   .order('attendance_id', { ascending: false });

    const { data, error } = await query;
    
    if (error) throw error;
    
    // Transform the data to match expected format
    const transformedData = data?.map(item => ({
      attendance_id: item.attendance_id,
      student_id: item.student_id,
      student_name: `${item.students.first_name} ${item.students.last_name}`,
      admission_number: item.students.admission_number,
      class_name: item.students.class_name,
      attendance_date: item.attendance_date,
      status: item.status,
      class_id: item.class_id
    })) || [];
    
    res.json(transformedData);
  } catch (err) { next(err); }
});

// ── Helper: resolve classId from either numeric ID or class_name string ───────
async function resolveClassId(schoolId, classId) {
  // Already a number
  if (!isNaN(Number(classId)) && Number(classId) > 0) return Number(classId);
  // Try looking up by name
  const { data: cls } = await supabase
    .from('classes')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('class_name', classId)
    .eq('is_deleted', false)
    .limit(1)
    .single();
  if (cls) return cls.class_id;
  // Class not in classes table — auto-create a placeholder so FK is satisfied
  const { data: result } = await supabase
    .from('classes')
    .insert({
      school_id: schoolId,
      class_name: classId,
      academic_year: new Date().getFullYear(),
      status: 'active'
    })
    .select('class_id')
    .single();
  return result.class_id;
}

// ── Bulk attendance save ──────────────────────────────────────────────────────
router.post("/bulk", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records) || !records.length)
      return res.status(400).json({ message: "classId, date and records array are required" });

    const resolvedClassId = await resolveClassId(schoolId, classId);

    // Delete existing for this class+date then re-insert
    await pool.query(
      `DELETE FROM attendance WHERE school_id=? AND class_id=? AND attendance_date=?`,
      [schoolId, resolvedClassId, date]
    );

    const values = records.map(r => [
      schoolId,
      r.studentId ?? r.student_id,
      resolvedClassId,
      date,
      r.status || "present",
      userId || null
    ]);

    await pool.query(
      `INSERT INTO attendance (school_id, student_id, class_id, attendance_date, status, marked_by_user_id) VALUES ?`,
      [values]
    );

    res.status(201).json({ saved: records.length });
  } catch (err) { next(err); }
});

// ── Single attendance record ──────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { studentId, classId, date, status = "present" } = req.body;
    if (!studentId || !classId || !date)
      return res.status(400).json({ message: "studentId, classId and date are required" });

    const resolvedClassId = await resolveClassId(schoolId, classId);

    await pool.query(
      `INSERT INTO attendance (school_id, student_id, class_id, attendance_date, status, marked_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status=VALUES(status), updated_at=CURRENT_TIMESTAMP`,
      [schoolId, studentId, resolvedClassId, date, status, userId || null]
    );
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, date } = req.body;
    const [result] = await pool.query(
      `UPDATE attendance SET status=?, attendance_date=?, updated_at=CURRENT_TIMESTAMP
      WHERE attendance_id=? AND school_id=?`,
      [status, date, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Record not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pool.query(
      `UPDATE attendance SET is_deleted=1 WHERE attendance_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;