import express from "express";
import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { pgPool } from "../config/pg.js";
import { getTeacherAssignedClasses } from "../utils/getTeacherClasses.js";
import { getPortalStudentIds } from "../utils/portalAccess.js";
const router = express.Router();

const isLocalMode = env.databaseMode === "local";

// ── Local PostgreSQL helpers ────────────────────────────────────────────────

async function localGetTeacherClassIds(schoolId, userId) {
  const result = await pgPool.query(
    `SELECT class_id FROM teacher_class_assignments
     WHERE school_id = $1 AND teacher_id = $2 AND is_active = true`,
    [schoolId, userId]
  );
  return result.rows.map(r => r.class_id).filter(Boolean);
}

async function localGetClassNameById(schoolId, classId) {
  if (!classId) return null;
  const result = await pgPool.query(
    `SELECT class_name FROM classes WHERE school_id = $1 AND class_id = $2 AND is_deleted = false LIMIT 1`,
    [schoolId, classId]
  );
  return result.rows[0]?.class_name || null;
}

async function localValidateTeacherClassAccess(schoolId, userId, classId) {
  if (!classId) return true;
  const className = await localGetClassNameById(schoolId, classId);
  const assignedClasses = await localGetTeacherAssignedClasses(schoolId, userId);
  if (!className || !assignedClasses.includes(className)) {
    throw new Error("Teacher can only access attendance for their assigned classes");
  }
  return true;
}

async function localResolveClassId({ schoolId, classId, className }) {
  if (classId && !Number.isNaN(Number(classId))) return Number(classId);
  if (!className) return null;
  const result = await pgPool.query(
    `SELECT class_id FROM classes WHERE school_id = $1 AND class_name = $2 AND is_deleted = false LIMIT 1`,
    [schoolId, className]
  );
  return result.rows[0]?.class_id || null;
}

async function localGetTeacherAssignedClasses(schoolId, userId) {
  const result = await pgPool.query(
    `SELECT class_name FROM teacher_class_assignments
     WHERE school_id = $1 AND teacher_id = $2 AND is_active = true`,
    [schoolId, userId]
  );
  return [...new Set(result.rows.map(r => r.class_name))];
}

// ── Cloud helpers (unchanged) ───────────────────────────────────────────────

async function cloudGetTeacherClassIds(schoolId, userId) {
  const { data: teacherClasses, error } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", userId)
    .eq("is_deleted", false);
  if (error) throw error;
  return teacherClasses?.map(tc => tc.class_id).filter(Boolean) || [];
}

async function cloudGetClassNameById(schoolId, classId) {
  if (!classId) return null;
  const { data, error } = await supabase
    .from("classes")
    .select("class_name")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) throw error;
  return data?.class_name || null;
}

async function cloudValidateTeacherClassAccess(schoolId, userId, classId) {
  if (!classId) return true;
  const className = await cloudGetClassNameById(schoolId, classId);
  const assignedClasses = await getTeacherAssignedClasses(schoolId, userId);
  if (!className || !assignedClasses.includes(className)) {
    throw new Error("Teacher can only access attendance for their assigned classes");
  }
  return true;
}

async function cloudResolveClassId({ schoolId, classId, className }) {
  if (classId && !Number.isNaN(Number(classId))) return Number(classId);
  if (!className) return null;
  const { data: classRow, error } = await supabase
    .from("classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("class_name", className)
    .eq("is_deleted", false)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return classRow?.class_id || null;
}

// ── Mode-dispatched helpers ─────────────────────────────────────────────────

const getTeacherClassIds = isLocalMode ? localGetTeacherClassIds : cloudGetTeacherClassIds;
const getClassNameById = isLocalMode ? localGetClassNameById : cloudGetClassNameById;
const validateTeacherClassAccess = isLocalMode ? localValidateTeacherClassAccess : cloudValidateTeacherClassAccess;
const resolveClassId = isLocalMode ? localResolveClassId : cloudResolveClassId;
const getTeacherAssignedClassesLocal = isLocalMode ? localGetTeacherAssignedClasses : getTeacherAssignedClasses;

// ── Routes ──────────────────────────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role, userId } = req.user;
    const { classId, date, from, to, studentId } = req.query;

    if (role === "teacher") {
      await validateTeacherClassAccess(schoolId, userId, classId);
    }

    if (isLocalMode) {
      let sql = `
        SELECT a.attendance_id, a.student_id, a.attendance_date, a.status, a.class_id,
               s.first_name, s.last_name, s.admission_number, s.class_name
        FROM attendance a
        JOIN students s ON s.student_id = a.student_id
        WHERE a.school_id = $1 AND a.is_deleted = false
      `;
      const params = [schoolId];

      if (role === "teacher") {
        const assignedClasses = await localGetTeacherAssignedClasses(schoolId, userId);
        if (!assignedClasses.length) return res.json([]);
        const placeholders = assignedClasses.map((_, i) => `$${params.length + 1 + i}`).join(", ");
        sql += ` AND s.class_name IN (${placeholders})`;
        params.push(...assignedClasses);
      }

      if (classId) {
        sql += ` AND a.class_id = $${params.length + 1}`;
        params.push(classId);
      }
      if (studentId) {
        sql += ` AND a.student_id = $${params.length + 1}`;
        params.push(studentId);
      }
      if (date) {
        sql += ` AND a.attendance_date = $${params.length + 1}`;
        params.push(date);
      }
      if (from) {
        sql += ` AND a.attendance_date >= $${params.length + 1}`;
        params.push(from);
      }
      if (to) {
        sql += ` AND a.attendance_date <= $${params.length + 1}`;
        params.push(to);
      }

      sql += ` ORDER BY a.attendance_date DESC, a.attendance_id DESC`;

      const result = await pgPool.query(sql, params);
      return res.json(result.rows);
    }

    // Cloud mode
    let query = supabase
      .from("attendance")
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
      .eq("school_id", schoolId)
      .eq("is_deleted", false);

    if (role === "teacher") {
      const assignedClasses = await getTeacherAssignedClasses(schoolId, userId);
      if (!assignedClasses.length) return res.json([]);
      query = query.in("students.class_name", assignedClasses);
    }

    if (role === "parent" || role === "student") {
      const portalStudentIds = await getPortalStudentIds(req, supabase);
      if (!portalStudentIds.length) return res.json([]);
      query = query.in("student_id", portalStudentIds);
    }

    if (classId) query = query.eq("class_id", classId);
    if (studentId) {
      if ((role === "parent" || role === "student")) {
        const portalStudentIds = await getPortalStudentIds(req, supabase);
        if (!portalStudentIds.map(String).includes(String(studentId))) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      query = query.eq("student_id", studentId);
    }
    if (date) query = query.eq("attendance_date", date);
    if (from) query = query.gte("attendance_date", from);
    if (to) query = query.lte("attendance_date", to);

    const { data, error } = await query
      .order("attendance_date", { ascending: false })
      .order("attendance_id", { ascending: false });
    if (error) throw error;

    const transformedData = (data || []).map(item => {
      const student = Array.isArray(item.students) ? (item.students[0] || {}) : (item.students || {});
      return {
        attendance_id: item.attendance_id,
        student_id: item.student_id,
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        admission_number: student.admission_number || null,
        class_name: student.class_name || null,
        attendance_date: item.attendance_date,
        status: item.status,
        class_id: item.class_id,
      };
    });

    res.json(transformedData);
  } catch (err) {
    next(err);
  }
});

router.post("/bulk", async (req, res, next) => {
  try {
    const { schoolId, role, userId } = req.user;
    const { classId, className, date, records } = req.body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Missing required fields: date, records" });
    }

    const resolvedClassId = await resolveClassId({ schoolId, classId, className });
    if (!resolvedClassId) {
      return res.status(400).json({ error: "Valid classId or className is required" });
    }

    if (role === "teacher") {
      const assignedClasses = await getTeacherAssignedClassesLocal(schoolId, userId);
      const resolvedClassName = className || await getClassNameById(schoolId, resolvedClassId);
      if (!resolvedClassName || !assignedClasses.includes(resolvedClassName)) {
        return res.status(403).json({ error: "Access denied: You can only manage attendance for your assigned classes" });
      }
    }

    if (isLocalMode) {
      const now = new Date().toISOString();
      for (const r of records) {
        await pgPool.query(
          `INSERT INTO attendance (school_id, student_id, class_id, attendance_date, status, marked_by_user_id, is_deleted, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (school_id, student_id, attendance_date)
           DO UPDATE SET status = EXCLUDED.status, class_id = EXCLUDED.class_id,
                         marked_by_user_id = EXCLUDED.marked_by_user_id, updated_at = NOW()`,
          [schoolId, r.studentId, resolvedClassId, date, r.status || "present", userId, false, now]
        );
      }
      return res.status(201).json({
        message: "Bulk attendance saved successfully",
        count: records.length,
      });
    }

    // Cloud mode
    const attendanceRecords = records.map(r => ({
      school_id: schoolId,
      student_id: r.studentId,
      class_id: resolvedClassId,
      attendance_date: date,
      status: r.status || "present",
      marked_by_user_id: userId,
      is_deleted: false,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("attendance")
      .upsert(attendanceRecords, { onConflict: "school_id,student_id,attendance_date" })
      .select();
    if (error) throw error;

    res.status(201).json({
      message: "Bulk attendance saved successfully",
      count: data.length,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { status, date } = req.body;

    if (isLocalMode) {
      const result = await pgPool.query(
        `UPDATE attendance
         SET status = COALESCE($1, status),
             attendance_date = COALESCE($2, attendance_date),
             updated_at = NOW()
         WHERE attendance_id = $3 AND school_id = $4 AND is_deleted = false
         RETURNING *`,
        [status, date, id, schoolId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      return res.json({
        message: "Attendance updated successfully",
        data: result.rows[0],
      });
    }

    // Cloud mode
    const updateData = {};
    if (status) updateData.status = status;
    if (date) updateData.attendance_date = date;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("attendance")
      .update(updateData)
      .eq("attendance_id", id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Attendance record not found" });

    res.json({
      message: "Attendance updated successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    if (isLocalMode) {
      const result = await pgPool.query(
        `UPDATE attendance
         SET is_deleted = true, updated_at = NOW()
         WHERE attendance_id = $1 AND school_id = $2 AND is_deleted = false
         RETURNING *`,
        [id, schoolId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      return res.json({ message: "Attendance deleted successfully" });
    }

    // Cloud mode
    const { data, error } = await supabase
      .from("attendance")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("attendance_id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Attendance record not found" });

    res.json({ message: "Attendance deleted successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
