import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";

const router = Router();

async function getSchoolLogoMap(schoolId) {
  const { data, error } = await supabase
    .from("school_settings")
    .select("setting_key, setting_value")
    .eq("school_id", schoolId)
    .in("setting_key", ["school_logo", "logo_url"]);

  if (error && error.code !== "PGRST205") throw error;

  const settings = new Map((data || []).map(item => [item.setting_key, item.setting_value]));
  return settings.get("school_logo") || settings.get("logo_url") || null;
}

async function findStudentForVerification(identifier) {
  const idValue = String(identifier || "").trim();
  if (!idValue) return null;

  let query = supabase
    .from("students")
    .select(`
      student_id,
      admission_number,
      first_name,
      last_name,
      status,
      school_id,
      schools:school_id (
        school_id,
        name
      )
    `)
    .eq("is_deleted", false);

  if (/^\d+$/.test(idValue)) {
    query = query.eq("student_id", Number(idValue));
  } else {
    query = query.eq("admission_number", idValue);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

router.get("/student/:studentId", async (req, res) => {
  try {
    const studentId = String(req.params.studentId || "").trim();
    if (!studentId) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

    let student = await findStudentForVerification(studentId);

    if (!student && /^\d+$/.test(studentId) === false) {
      const numericFallback = studentId.replace(/[^\d]/g, "");
      if (numericFallback) {
        student = await findStudentForVerification(numericFallback);
      }
    }

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const school = student.schools || {};
    const schoolLogo = student.school_id ? await getSchoolLogoMap(student.school_id) : null;

    return res.json({
      student: {
        studentId: student.student_id,
        firstName: student.first_name,
        lastName: student.last_name,
        admissionNumber: student.admission_number,
        status: student.status,
        school: {
          id: school.school_id || student.school_id,
          name: school.name || "EduCore",
          logo_url: schoolLogo,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching student for QR verification:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
