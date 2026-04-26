/**
 * GET  /api/analysis/performance-sheet?term=Term+1&class_name=Grade+7
 *
 * Returns a full KNEC-graded class performance sheet:
 *   - students ranked 1..N by mean score
 *   - per-subject KNEC grade (EE1, ME2, …)
 *   - class subject means
 *
 * READ-ONLY: no writes. Safe to deploy to production immediately.
 * Dual-reads alongside existing analysis routes — does not replace them.
 */

import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { classRanking, subjectMeans } from "../utils/knecGrading.js";

const router = Router();

// Official CBC class order for sorting
const CLASS_ORDER = ["Playgroup","PP1","PP2","Grade 1","Grade 2","Grade 3",
                     "Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
const classIdx = n => { const i = CLASS_ORDER.indexOf(n); return i === -1 ? 99 : i; };

// ── GET /api/performance/sheet ─────────────────────────────────────────────────
router.get("/sheet", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term      = req.query.term       || null;
    const className = req.query.class_name || null;

    if (!term)      return res.status(400).json({ message: "term is required" });
    if (!className) return res.status(400).json({ message: "class_name is required" });

    // 1. Pull results for this class+term
    const { data: results, error: rErr } = await supabase
      .from("results")
      .select("student_id, subject, marks, total_marks")
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("is_deleted", false);
    if (rErr) throw rErr;

    // 2. Pull active class_id for this class_name
    const { data: classes, error: cErr } = await supabase
      .from("classes")
      .select("class_id")
      .eq("school_id", schoolId)
      .eq("class_name", className)
      .eq("is_deleted", false)
      .eq("status", "active");
    if (cErr) throw cErr;
    const validClassIds = new Set((classes || []).map(c => c.class_id));

    // 3. Pull students in this class
    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, admission_number, class_name")
      .eq("school_id", schoolId)
      .eq("class_name", className)
      .eq("status", "active")
      .eq("is_deleted", false);
    if (sErr) throw sErr;

    const studentMap = new Map((students || []).map(s => [s.student_id, s]));

    // 4. Group results by student
    const byStudent = new Map();
    for (const r of (results || [])) {
      const s = studentMap.get(r.student_id);
      if (!s) continue; // student not in this class
      if (!byStudent.has(r.student_id)) {
        byStudent.set(r.student_id, {
          student_id:       r.student_id,
          name:             `${s.first_name} ${s.last_name}`.trim(),
          admission_number: s.admission_number || "",
          class_name:       className,
          subjects:         [],
        });
      }
      byStudent.get(r.student_id).subjects.push({
        subject:     r.subject,
        marks:       Number(r.marks || 0),
        total_marks: Number(r.total_marks || 100),
      });
    }

    // 5. Rank students with KNEC grades
    const ranked = classRanking([...byStudent.values()]);
    const classMeans = subjectMeans(ranked);

    // 6. Collect all subjects for column headers
    const allSubjects = [...new Set(ranked.flatMap(s => s.subjectScores.map(sc => sc.subject)))].sort();

    res.json({
      term,
      class_name:   className,
      student_count: ranked.length,
      subjects:     allSubjects,
      class_means:  classMeans,
      students:     ranked,
    });
  } catch (err) { next(err); }
});

// ── GET /api/performance/classes?term=Term+1 ─────────────────────────────────
// Returns available classes in CBC order for the performance sheet dropdown
router.get("/classes", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data, error } = await supabase
      .from("classes")
      .select("class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .eq("status", "active");
    if (error) throw error;
    const names = [...new Set((data || []).map(c => c.class_name).filter(Boolean))];
    names.sort((a, b) => classIdx(a) - classIdx(b));
    res.json(names);
  } catch (err) { next(err); }
});

export default router;
