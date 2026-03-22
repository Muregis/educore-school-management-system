import express from "express";
import { supabase } from "../config/supabase.js";

const router = express.Router();

async function getTeacherClassIds(schoolId, userId) {
  const { data: teacherClasses, error } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", userId)
    .eq("is_deleted", false);
  if (error) throw error;
  return teacherClasses?.map(tc => tc.class_id).filter(Boolean) || [];
}

async function resolveClassId({ schoolId, classId, className }) {
  if (classId && !Number.isNaN(Number(classId))) return Number(classId);

  if (!className) return null;

  const { data: classRow, error } = await supabase
    .from("classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("class_name", className)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) throw error;

  return classRow?.class_id || null;
}

router.get("/", async (req, res, next) => {
  try {
    // OLD: const { schoolId, role, user_id } = req.user;
    const { schoolId, role, userId } = req.user;
    const { classId, date, from, to, studentId } = req.query;

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
      const allowedClassIds = await getTeacherClassIds(schoolId, userId);
      if (!allowedClassIds.length) return res.json([]);
      query = query.in("class_id", allowedClassIds);
    }

    if (classId) query = query.eq("class_id", classId);
    if (studentId) query = query.eq("student_id", studentId);
    if (date) query = query.eq("attendance_date", date);
    if (from) query = query.gte("attendance_date", from);
    if (to) query = query.lte("attendance_date", to);

    const { data, error } = await query
      .order("attendance_date", { ascending: false })
      .order("attendance_id", { ascending: false });
    if (error) throw error;

    const transformedData = (data || []).map(item => {
      // OLD: const student = item.students || {};
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
    // OLD: const { schoolId, role, user_id } = req.user;
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
      const allowedClassIds = await getTeacherClassIds(schoolId, userId);
      if (!allowedClassIds.includes(resolvedClassId)) {
        return res.status(403).json({ error: "Access denied: You can only manage attendance for your assigned classes" });
      }
    }

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
