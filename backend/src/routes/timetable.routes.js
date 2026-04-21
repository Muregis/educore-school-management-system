import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js"; 
const router = Router();
router.use(authRequired);

// Abbreviated ENUM values used in the DB
const DAY_MAP = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};
const DAY_EXPAND = Object.fromEntries(Object.entries(DAY_MAP).map(([k, v]) => [v, k]));

function normalise(r) {
  return {
    timetable_id: r.timetable_id,
    class_id:     r.class_id,
    class_name:   r.class_name ?? "",
    subject:      r.subject_name ?? "",
    teacher_id:   r.teacher_id,
    teacher_name: r.teacher_name ?? "",
    day_of_week:  DAY_EXPAND[r.day_of_week] ?? r.day_of_week, // return full name to frontend
    start_time:   r.start_time,
    end_time:     r.end_time,
    period:       r.room ?? "",
    school_id:    r.school_id,
  };
}

// ─── GET /api/timetable ───────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, teacherId } = req.query;

    let classId = null;
    if (className) {
      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("class_id")
        .eq("school_id", schoolId)
        .eq("class_name", className)
        .eq("is_deleted", false)
        .limit(1)
        .maybeSingle();
      if (clsErr) throw clsErr;
      classId = cls?.class_id ?? null;
      if (!classId) return res.json([]);
    }

    let q = supabase
      .from("timetable_entries")
      .select("timetable_id, class_id, subject_name, teacher_id, day_of_week, start_time, end_time, room, school_id")
      .eq("school_id", schoolId)
      .eq("is_deleted", false);

    if (classId) q = q.eq("class_id", classId);
    if (teacherId) q = q.eq("teacher_id", teacherId);

    const { data: entries, error: entErr } = await q;
    if (entErr) throw entErr;

    const classIds = Array.from(new Set((entries || []).map(e => e.class_id).filter(Boolean)));
    const teacherIds = Array.from(new Set((entries || []).map(e => e.teacher_id).filter(Boolean)));

    const [{ data: classes, error: cErr }, { data: teachers, error: tErr }] = await Promise.all([
      classIds.length
        ? supabase.from("classes").select("class_id, class_name").eq("school_id", schoolId).in("class_id", classIds)
        : Promise.resolve({ data: [], error: null }),
      teacherIds.length
        ? supabase.from("teachers").select("teacher_id, first_name, last_name").eq("school_id", schoolId).in("teacher_id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (cErr) throw cErr;
    if (tErr) throw tErr;

    const classMap = new Map((classes || []).map(c => [String(c.class_id), c.class_name]));
    const teacherMap = new Map((teachers || []).map(t => [String(t.teacher_id), `${t.first_name || ""} ${t.last_name || ""}`.trim()]));

    const dayOrder = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const rows = (entries || [])
      .map(e => ({
        ...e,
        class_name: classMap.get(String(e.class_id)) ?? "",
        teacher_name: teacherMap.get(String(e.teacher_id)) ?? "",
      }))
      .sort((a, b) => (dayOrder[a.day_of_week] || 99) - (dayOrder[b.day_of_week] || 99) || String(a.start_time).localeCompare(String(b.start_time)));

    res.json(rows.map(normalise));
  } catch (err) { next(err); }
});

// ─── POST /api/timetable ─────────────────────────────────────────────────────
router.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, dayOfWeek, period, startTime, endTime, subject, teacherId } = req.body;

    if (!className || !dayOfWeek || !subject || !startTime || !endTime)
      return res.status(400).json({ message: "className, dayOfWeek, subject, startTime, endTime are required" });

    // Resolve class_id from class_name
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('class_name', className)
      .eq('is_deleted', false)
      .single();
    if (clsErr) throw clsErr;
    if (!cls) return res.status(404).json({ message: `Class "${className}" not found` });

    const abbrevDay = DAY_MAP[dayOfWeek] ?? dayOfWeek;

    const { data: inserted, error: insErr } = await supabase
      .from('timetable_entries')
      .insert({
        school_id: schoolId,
        class_id: cls.class_id,
        subject_name: subject,
        teacher_id: teacherId || null,
        day_of_week: abbrevDay,
        start_time: startTime,
        end_time: endTime,
        room: period || null
      })
      .select('timetable_id')
      .single();
    if (insErr) throw insErr;
    res.status(201).json({ timetableId: inserted.timetable_id });
  } catch (err) { next(err); }
});

// ─── PUT /api/timetable/:id ───────────────────────────────────────────────────
router.put("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, dayOfWeek, period, startTime, endTime, subject, teacherId } = req.body;

    let classId = null;
    if (className) {
      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('class_name', className)
        .eq('is_deleted', false)
        .single();
      if (clsErr) throw clsErr;
      if (!cls) return res.status(404).json({ message: `Class "${className}" not found` });
      classId = cls.class_id;
    }

    const abbrevDay = dayOfWeek ? (DAY_MAP[dayOfWeek] ?? dayOfWeek) : undefined;

    const updateData = {};
    if (classId) updateData.class_id = classId;
    if (subject) updateData.subject_name = subject;
    if (teacherId !== undefined) updateData.teacher_id = teacherId;
    if (abbrevDay) updateData.day_of_week = abbrevDay;
    if (startTime) updateData.start_time = startTime;
    if (endTime) updateData.end_time = endTime;
    if (period !== undefined) updateData.room = period;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await supabase
      .from('timetable_entries')
      .update(updateData)
      .eq('timetable_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('timetable_id')
      .single();
    if (updErr) throw updErr;
    if (!updated) return res.status(404).json({ message: "Entry not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE /api/timetable/:id ────────────────────────────────────────────────
router.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: updated, error } = await supabase
      .from('timetable_entries')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('timetable_id', req.params.id)
      .eq('school_id', schoolId)
      .select('timetable_id')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Entry not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
