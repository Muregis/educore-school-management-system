import { Router } from "express";
import { pgPool } from "../config/pg.js";
import { supabase } from "../config/db.js";
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

    // OLD: let sql = `SELECT te.timetable_id, te.class_id, te.subject_name, te.teacher_id,
    // OLD:         te.day_of_week, te.start_time, te.end_time, te.room, te.school_id,
    // OLD:         COALESCE(c.class_name, '') AS class_name,
    // OLD:         CONCAT(t.first_name, ' ', t.last_name) AS teacher_name
    // OLD:   FROM timetable_entries te
    // OLD:   LEFT JOIN classes  c ON c.class_id  = te.class_id
    // OLD:   LEFT JOIN teachers t ON t.teacher_id = te.teacher_id
    // OLD:   WHERE te.school_id = $1 AND te.is_deleted = false`;
    // OLD: const params = [schoolId];
    // OLD: if (className) { sql += " AND c.class_name = $2"; params.push(className); }
    // OLD: if (teacherId) { sql += " AND te.teacher_id = ?"; params.push(teacherId); }
    // OLD: sql += " ORDER BY FIELD(te.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), te.start_time";
    // OLD: const [rows] = await pool.query(sql, params);
    // OLD: res.json(rows.map(normalise));

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
router.post("/", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, dayOfWeek, period, startTime, endTime, subject, teacherId } = req.body;

    if (!className || !dayOfWeek || !subject || !startTime || !endTime)
      return res.status(400).json({ message: "className, dayOfWeek, subject, startTime, endTime are required" });

    // Resolve class_id from class_name
    const { rows } = await pgPool.query(
      `SELECT class_id FROM classes WHERE school_id = $1 AND class_name = $2 AND is_deleted = false LIMIT 1`,
      [schoolId, className]
    );
    if (!rows.length) return res.status(404).json({ message: `Class "${className}" not found` });

    const abbrevDay = DAY_MAP[dayOfWeek] ?? dayOfWeek; // accept both full and abbrev

    const { rows: result } = await pgPool.query(
      `INSERT INTO timetable_entries
        (school_id, class_id, subject_name, teacher_id, day_of_week, start_time, end_time, room)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [schoolId, cls[0].class_id, subject, teacherId || null, abbrevDay, startTime, endTime, period || null]
    );
    res.status(201).json({ timetableId: result[0].id });
  } catch (err) { next(err); }
});

// ─── PUT /api/timetable/:id ───────────────────────────────────────────────────
router.put("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, dayOfWeek, period, startTime, endTime, subject, teacherId } = req.body;

    let classId = null;
    if (className) {
      const [cls] = await pool.query(
        `SELECT class_id FROM classes WHERE school_id = ? AND class_name = ? AND is_deleted = 0 LIMIT 1`,
        [schoolId, className]
      );
      if (!cls.length) return res.status(404).json({ message: `Class "${className}" not found` });
      classId = cls[0].class_id;
    }

    const abbrevDay = dayOfWeek ? (DAY_MAP[dayOfWeek] ?? dayOfWeek) : undefined;

    const [result] = await pool.query(
      `UPDATE timetable_entries
      SET class_id=COALESCE(?,class_id), subject_name=COALESCE(?,subject_name),
            teacher_id=?, day_of_week=COALESCE(?,day_of_week),
            start_time=COALESCE(?,start_time), end_time=COALESCE(?,end_time),
            room=?, updated_at=CURRENT_TIMESTAMP
        WHERE timetable_id=? AND school_id=? AND is_deleted=0`,
      [classId, subject || null, teacherId ?? null, abbrevDay || null,
      startTime || null, endTime || null, period ?? null,
      req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Entry not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE /api/timetable/:id ────────────────────────────────────────────────
router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE timetable_entries SET is_deleted=1, updated_at=CURRENT_TIMESTAMP
      WHERE timetable_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Entry not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
