import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { getTeacherAssignedClasses } from "../utils/getTeacherClasses.js";

const router = Router();
router.use(authRequired);

// Day mapping (DB ↔ frontend)
const DAY_MAP = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const DAY_EXPAND = Object.fromEntries(
  Object.entries(DAY_MAP).map(([k, v]) => [v, k])
);

function normalise(r) {
  return {
    timetable_id: r.timetable_id,
    class_id: r.class_id,
    class_name: r.class_name ?? "",
    subject: r.subject_name ?? "",
    teacher_id: r.teacher_id,
    teacher_name: r.teacher_name ?? "",
    day_of_week: DAY_EXPAND[r.day_of_week] ?? r.day_of_week,
    start_time: r.start_time,
    end_time: r.end_time,
    period: r.room ?? "",
    school_id: r.school_id,
  };
}

// ================= GET TIMETABLE =================
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role, userId } = req.user;
    const { className, teacherId } = req.query;

    let q = supabase
      .from("timetable_entries")
      .select(
        "timetable_id, class_id, subject_name, teacher_id, day_of_week, start_time, end_time, room, school_id"
      )
      .eq("school_id", schoolId)
      .eq("is_deleted", false);

    let classId = null;

    // class filter
    if (className) {
      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("class_id")
        .eq("school_id", schoolId)
        .eq("class_name", className)
        .eq("is_deleted", false)
        .maybeSingle();

      if (clsErr) throw clsErr;
      if (!cls) return res.json([]);

      classId = cls.class_id;
      q = q.eq("class_id", classId);
    }

    // teacher filter (query param)
    if (teacherId) {
      q = q.eq("teacher_id", teacherId);
    }

    // role restriction
    if (role === "teacher") {
      const assignedClasses = await getTeacherAssignedClasses(schoolId, userId);

      if (!assignedClasses || assignedClasses.length === 0) {
        return res.json([]);
      }

      const { data: classRows, error: classRowsErr } = await supabase
        .from("classes")
        .select("class_id")
        .eq("school_id", schoolId)
        .in("class_name", assignedClasses)
        .eq("is_deleted", false);

      if (classRowsErr) throw classRowsErr;
      const classIds = (classRows || []).map(c => c.class_id).filter(Boolean);
      if (classIds.length === 0) return res.json([]);

      q = q.in("class_id", classIds);
    }

    // execute query
    const { data: entries, error: entErr } = await q;
    if (entErr) throw entErr;

    const classIds = [
      ...new Set((entries || []).map(e => e.class_id).filter(Boolean))
    ];

    const teacherIds = [
      ...new Set((entries || []).map(e => e.teacher_id).filter(Boolean))
    ];

    const [{ data: classes }, { data: teachers }] = await Promise.all([
      classIds.length
        ? supabase
            .from("classes")
            .select("class_id, class_name")
            .eq("school_id", schoolId)
            .in("class_id", classIds)
        : Promise.resolve({ data: [] }),

      teacherIds.length
        ? supabase
            .from("teachers")
            .select("teacher_id, first_name, last_name")
            .eq("school_id", schoolId)
            .in("teacher_id", teacherIds)
        : Promise.resolve({ data: [] }),
    ]);

    const classMap = new Map(
      (classes || []).map(c => [String(c.class_id), c.class_name])
    );

    const teacherMap = new Map(
      (teachers || []).map(t => [
        String(t.teacher_id),
        `${t.first_name || ""} ${t.last_name || ""}`.trim(),
      ])
    );

    const dayOrder = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

    const rows = (entries || [])
      .map(e => ({
        ...e,
        class_name: classMap.get(String(e.class_id)) ?? "",
        teacher_name: teacherMap.get(String(e.teacher_id)) ?? "",
      }))
      .sort(
        (a, b) =>
          (dayOrder[a.day_of_week] || 99) -
            (dayOrder[b.day_of_week] || 99) ||
          String(a.start_time).localeCompare(String(b.start_time))
      );

    return res.json(rows.map(normalise));
  } catch (err) {
    next(err);
  }
});

// ================= CREATE =================
router.post(
  "/",
  requireRoles("admin", "director", "superadmin"),
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { className, dayOfWeek, period, startTime, endTime, subject, teacherId } =
        req.body;

      if (!className || !dayOfWeek || !subject || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("class_id")
        .eq("school_id", schoolId)
        .eq("class_name", className)
        .eq("is_deleted", false)
        .single();

      if (clsErr) throw clsErr;
      if (!cls) return res.status(404).json({ message: "Class not found" });

      const abbrevDay = DAY_MAP[dayOfWeek] ?? dayOfWeek;

      const { data: inserted, error: insErr } = await supabase
        .from("timetable_entries")
        .insert({
          school_id: schoolId,
          class_id: cls.class_id,
          subject_name: subject,
          teacher_id: teacherId || null,
          day_of_week: abbrevDay,
          start_time: startTime,
          end_time: endTime,
          room: period || null,
        })
        .select("timetable_id")
        .single();

      if (insErr) throw insErr;

      return res.status(201).json({ timetableId: inserted.timetable_id });
    } catch (err) {
      next(err);
    }
  }
);

export default router;