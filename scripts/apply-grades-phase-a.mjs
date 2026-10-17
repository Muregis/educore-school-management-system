#!/usr/bin/env node
import fs from "fs";

function mustInclude(path, needle) {
  if (!fs.readFileSync(path, "utf8").includes(needle)) {
    console.error("MISSING after patch:", path, needle);
    process.exit(1);
  }
}

// --- grading.js CBC sub-levels ---
{
  const path = "src/lib/grading.js";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("CBC_SUB_LEVELS")) {
    const block = `
// CBC Sub-levels (Kenya primary/junior practice: EE1/EE2 … BE1/BE2)
export const CBC_SUB_LEVELS = [
  { grade: 'EE1', min: 90, max: 100, parent: 'EE', label: 'Exceeds Expectations (1)', color: '#16a34a' },
  { grade: 'EE2', min: 80, max: 89,  parent: 'EE', label: 'Exceeds Expectations (2)', color: '#22c55e' },
  { grade: 'ME1', min: 70, max: 79,  parent: 'ME', label: 'Meets Expectations (1)', color: '#2563eb' },
  { grade: 'ME2', min: 65, max: 69,  parent: 'ME', label: 'Meets Expectations (2)', color: '#3b82f6' },
  { grade: 'AE1', min: 55, max: 64,  parent: 'AE', label: 'Approaches Expectations (1)', color: '#d97706' },
  { grade: 'AE2', min: 50, max: 54,  parent: 'AE', label: 'Approaches Expectations (2)', color: '#f59e0b' },
  { grade: 'BE1', min: 40, max: 49,  parent: 'BE', label: 'Below Expectations (1)', color: '#ef4444' },
  { grade: 'BE2', min: 0,  max: 39,  parent: 'BE', label: 'Below Expectations (2)', color: '#b91c1c' },
];

export function calculateCbcSubLevel(percentage) {
  if (percentage === null || percentage === undefined || Number.isNaN(Number(percentage))) {
    return { grade: '-', parent: '-', label: 'No Score', color: '#9ca3af' };
  }
  const pct = Number(percentage);
  const found = CBC_SUB_LEVELS.find(g => pct >= g.min && pct <= g.max);
  return found
    ? { grade: found.grade, parent: found.parent, label: found.label, color: found.color, min: found.min, max: found.max }
    : { grade: 'BE2', parent: 'BE', label: 'Below Expectations (2)', color: '#b91c1c' };
}

export function cbcParentGrade(subOrParent) {
  const s = String(subOrParent || '').toUpperCase();
  if (['EE', 'ME', 'AE', 'BE'].includes(s)) return s;
  const found = CBC_SUB_LEVELS.find(g => g.grade === s);
  return found?.parent || '-';
}
`;
    t = t.replace("// KNEC Grading Scale (8-4-4 system)", block + "\n// KNEC Grading Scale (8-4-4 system)");
    t = t.replace("  const allGrades = [...CBC_GRADES, ...KNEC_GRADES];", "  const allGrades = [...CBC_GRADES, ...CBC_SUB_LEVELS, ...KNEC_GRADES];");
    t = t.replace("export default {\n  calculateGrade,", "export default {\n  calculateGrade,\n  calculateCbcSubLevel,\n  cbcParentGrade,\n  CBC_SUB_LEVELS,");
    fs.writeFileSync(path, t);
  }
  console.log("grading.js ok");
}

// --- analysis merit ---
{
  const path = "backend/src/routes/analysis.routes.js";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes('router.get("/merit"')) {
    const merit = `
router.get("/merit", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term;
    const className = req.query.class_name || null;
    const streamFilter = req.query.stream ? String(req.query.stream).trim() : null;
    if (!term) return res.status(400).json({ error: "Term parameter is required" });

    const { data: raw, error: resultsErr } = await supabase
      .from("results")
      .select("term,subject,marks,total_marks,student_id,class_id,is_deleted,school_id")
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("is_deleted", false);
    if (resultsErr) throw resultsErr;

    const studentIds = [...new Set((raw || []).map(r => r.student_id).filter(Boolean))];
    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase.from("classes").select("class_id,class_name,section,is_deleted,status")
        .eq("school_id", schoolId).eq("is_deleted", false).eq("status", "active"),
      studentIds.length
        ? supabase.from("students").select("student_id,first_name,last_name,admission_number,class_name,is_deleted,status").eq("school_id", schoolId).in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesErr) throw classesErr;
    if (studentsErr) throw studentsErr;

    const classById = new Map((classesRows || []).map(c => [c.class_id, c]));
    const classByName = new Map((classesRows || []).map(c => [classKey(c.class_name), c]));
    const studentById = new Map((studentsRows || []).map(s => [s.student_id, s]));
    const getClass = (r) => classById.get(r.class_id) || classByName.get(classKey(studentById.get(r.student_id)?.class_name));
    const pct = (r) => {
      const denom = Number(r.total_marks || 0);
      if (!denom) return null;
      return (Number(r.marks || 0) / denom) * 100;
    };
    const subLevel = (percentage) => {
      if (percentage == null || Number.isNaN(percentage)) return { grade: "-", parent: "-" };
      const p = Number(percentage);
      if (p >= 90) return { grade: "EE1", parent: "EE" };
      if (p >= 80) return { grade: "EE2", parent: "EE" };
      if (p >= 70) return { grade: "ME1", parent: "ME" };
      if (p >= 65) return { grade: "ME2", parent: "ME" };
      if (p >= 55) return { grade: "AE1", parent: "AE" };
      if (p >= 50) return { grade: "AE2", parent: "AE" };
      if (p >= 40) return { grade: "BE1", parent: "BE" };
      return { grade: "BE2", parent: "BE" };
    };

    const cleanRows = (raw || []).filter(r => {
      const c = getClass(r);
      if (!c || c.is_deleted || c.status !== "active") return false;
      if (className && c.class_name !== className) return false;
      if (streamFilter) {
        const sec = String(c.section || "").trim();
        if (sec.toLowerCase() !== streamFilter.toLowerCase()) return false;
      }
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted || s.status !== "active") return false;
      return true;
    });

    const subjectSet = new Set();
    const studentAgg = new Map();
    for (const r of cleanRows) {
      const p = pct(r);
      if (p == null) continue;
      const subj = r.subject || "Subject";
      subjectSet.add(subj);
      if (!studentAgg.has(r.student_id)) {
        studentAgg.set(r.student_id, { sum: 0, count: 0, totalMarks: 0, class_id: r.class_id, class_ref: getClass(r), subjects: {} });
      }
      const a = studentAgg.get(r.student_id);
      a.sum += p; a.count += 1; a.totalMarks += Number(r.marks || 0);
      const sl = subLevel(p);
      a.subjects[subj] = { marks: Number(r.marks || 0), total: Number(r.total_marks || 0), percentage: Number(p.toFixed(1)), sub_level: sl.grade, grade: sl.parent };
      a.class_ref = getClass(r) || a.class_ref;
    }

    const subjects = [...subjectSet].sort((a, b) => a.localeCompare(b));
    const scored = [...studentAgg.entries()].map(([student_id, a]) => {
      const s = studentById.get(student_id) || {};
      const c = a.class_ref || classById.get(a.class_id) || {};
      const average = a.count ? Number((a.sum / a.count).toFixed(2)) : 0;
      const overall = subLevel(average);
      return {
        student_id, first_name: s.first_name || "", last_name: s.last_name || "",
        admission_number: s.admission_number || null,
        class_name: c.class_name || s.class_name || "", stream: c.section || "",
        stream_label: c.class_name && c.section ? \`\${c.class_name} \${c.section}\` : (c.class_name || ""),
        total_marks: a.totalMarks, average,
        overall_grade: overall.parent, overall_sub_level: overall.grade,
        subjects: a.subjects, subjects_sat: Object.keys(a.subjects).length,
      };
    }).sort((a, b) => b.average - a.average || b.total_marks - a.total_marks);

    let currentRank = 1, prevAvg = null;
    const rows = scored.map((s, idx) => {
      if (prevAvg !== null && s.average < prevAvg - 0.001) currentRank = idx + 1;
      prevAvg = s.average;
      return { ...s, rank: currentRank };
    });

    const streams = [...new Set((classesRows || []).filter(c => !className || c.class_name === className).map(c => c.section).filter(Boolean))].sort();

    res.json({ rows, subjects, streams, meta: { term, class_name: className, stream: streamFilter, mode: streamFilter ? "stream" : "consolidated", learner_count: rows.length } });
  } catch (err) { next(err); }
});
`;
    t = t.replace("export default router;", merit + "\nexport default router;");
    fs.writeFileSync(path, t);
  }
  console.log("analysis merit ok");
}

// --- App.jsx ---
{
  const path = "src/App.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("MeritListPage")) {
    t = t.replace('import AnalysisPage from "./pages/AnalysisPage";', 'import AnalysisPage from "./pages/AnalysisPage";\nimport MeritListPage from "./pages/MeritListPage";');
    t = t.replace('    analysis:          { title: "Analysis",           desc: "Analyze academic performance, trends, and statistical data." },', '    analysis:          { title: "Analysis",           desc: "Analyze academic performance, trends, and statistical data." },\n    merit:             { title: "Merit Lists",        desc: "Stream and consolidated merit lists with CBC sub-levels." },');
    t = t.replace('    analysis: ["admin","teacher","director","superadmin"].includes(auth.role) ? <AnalysisPage auth={auth} toast={toast} /> : <Forbidden />,', '    analysis: ["admin","teacher","director","superadmin"].includes(auth.role) ? <AnalysisPage auth={auth} toast={toast} /> : <Forbidden />,\n    merit: ["admin","teacher","director","superadmin"].includes(auth.role) ? <MeritListPage auth={auth} toast={toast} /> : <Forbidden />,');
    fs.writeFileSync(path, t);
  }
  console.log("App.jsx ok");
}

// --- Sidebar ---
{
  const path = "src/components/Sidebar.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes('{ id: "merit"')) {
    t = t.replace('{ id: "grades", label: "Grades", icon: "\ud83e\uddfe" },', '{ id: "grades", label: "Grades", icon: "\ud83e\uddfe" },\n      { id: "merit", label: "Merit Lists", icon: "\ud83c\udfc6" },');
    t = t.replace('teacher: ["dashboard", "subjects", "attendance", "grades", "reportcards", "discipline", "timetable", "communication", "library", "analysis", "lessonplans", "announcements", "exams"],', 'teacher: ["dashboard", "subjects", "attendance", "grades", "merit", "reportcards", "discipline", "timetable", "communication", "library", "analysis", "lessonplans", "announcements", "exams"],');
    t = t.replace('admin: ["dashboard", "students", "teachers", "subjects", "attendance", "grades", "fees", "expenditures", "invoices", "reportcards", "discipline", "transport", "communication", "timetable", "library", "lessonplans", "announcements", "exams", "admissions", "hr", "bulk-import", "term-management", "academic-transition"],', 'admin: ["dashboard", "students", "teachers", "subjects", "attendance", "grades", "merit", "fees", "expenditures", "invoices", "reportcards", "discipline", "transport", "communication", "timetable", "library", "lessonplans", "announcements", "exams", "admissions", "hr", "bulk-import", "term-management", "academic-transition", "analysis"],');
    fs.writeFileSync(path, t);
  }
  console.log("Sidebar ok");
}

mustInclude("src/lib/grading.js", "CBC_SUB_LEVELS");
mustInclude("backend/src/routes/analysis.routes.js", 'router.get("/merit"');
mustInclude("src/App.jsx", "MeritListPage");
mustInclude("src/components/Sidebar.jsx", '{ id: "merit"');
console.log("PHASE A CORE PATCHES OK — MeritListPage.jsx must also be present");
