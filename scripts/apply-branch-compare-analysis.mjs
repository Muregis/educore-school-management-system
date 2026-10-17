#!/usr/bin/env node
import fs from "fs";

const path = "backend/src/routes/analysis.routes.js";
let t = fs.readFileSync(path, "utf8");

if (t.includes("GET /api/analysis/branch-compare")) {
  console.log("branch-compare already present");
  process.exit(0);
}

if (!t.includes('from "../services/branch.service.js"')) {
  t = t.replace(
    'import { supabase } from "../config/supabaseClient.js";',
    'import { supabase } from "../config/supabaseClient.js";\nimport { getAccessibleSchoolIds, getSchoolWithBranches } from "../services/branch.service.js";'
  );
}

const endpoint = `
/**
 * GET /api/analysis/branch-compare
 * Query: term (required), class_name (optional)
 * Compares parent school vs its branches for the same term.
 * Scope: only schools in the director's parent/branch group.
 */
router.get("/branch-compare", authRequired, async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;
    const term = req.query.term ? String(req.query.term).trim() : null;
    const className = req.query.class_name ? String(req.query.class_name).trim() : null;
    if (!term) return res.status(400).json({ error: "Term parameter is required" });

    const accessible = await getAccessibleSchoolIds(userId, schoolId);
    const schoolIds = [...new Set((accessible || []).map(Number).filter(Boolean))];
    if (schoolIds.length === 0) {
      return res.json({
        campuses: [],
        subjects: [],
        meta: { term, class_name: className, message: "No accessible campuses" },
      });
    }

    const { data: schools, error: schErr } = await supabase
      .from("schools")
      .select("school_id, name, code, is_branch, parent_school_id, branch_code")
      .in("school_id", schoolIds)
      .eq("is_deleted", false);
    if (schErr) throw schErr;
    const schoolMap = new Map((schools || []).map((s) => [s.school_id, s]));

    const { data: raw, error: resErr } = await supabase
      .from("results")
      .select("school_id, term, subject, marks, total_marks, student_id, class_id, is_deleted")
      .in("school_id", schoolIds)
      .eq("term", term)
      .eq("is_deleted", false);
    if (resErr) throw resErr;

    const classIds = [...new Set((raw || []).map((r) => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((raw || []).map((r) => r.student_id).filter(Boolean))];

    const [{ data: classesRows }, { data: studentsRows }] = await Promise.all([
      classIds.length
        ? supabase.from("classes").select("class_id, class_name, section, school_id, is_deleted, status").in("class_id", classIds).eq("is_deleted", false)
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? supabase.from("students").select("student_id, school_id, class_name, is_deleted, status").in("student_id", studentIds).eq("is_deleted", false)
        : Promise.resolve({ data: [] }),
    ]);

    const classById = new Map((classesRows || []).map((c) => [c.class_id, c]));
    const studentById = new Map((studentsRows || []).map((s) => [s.student_id, s]));

    const pct = (r) => {
      const denom = Number(r.total_marks || 0) || 100;
      const marks = Number(r.marks);
      if (!Number.isFinite(marks)) return null;
      return (marks / denom) * 100;
    };

    const byCampus = new Map();
    for (const sid of schoolIds) {
      byCampus.set(sid, { studentAgg: new Map(), subjectAgg: new Map(), streamAgg: new Map() });
    }

    for (const r of raw || []) {
      const sid = r.school_id;
      if (!byCampus.has(sid)) continue;
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted || (s.status && s.status !== "active")) continue;
      const c = r.class_id ? classById.get(r.class_id) : null;
      if (className) {
        const cn = String(c?.class_name || s.class_name || "").trim();
        const want = className.trim();
        if (cn !== want && !cn.startsWith(want + " ")) continue;
      }
      const p = pct(r);
      if (p == null) continue;

      const camp = byCampus.get(sid);
      if (!camp.studentAgg.has(r.student_id)) camp.studentAgg.set(r.student_id, { sum: 0, count: 0 });
      const sa = camp.studentAgg.get(r.student_id);
      sa.sum += p;
      sa.count += 1;

      const subj = String(r.subject || "").trim();
      if (subj) {
        if (!camp.subjectAgg.has(subj)) camp.subjectAgg.set(subj, { sum: 0, count: 0 });
        const xa = camp.subjectAgg.get(subj);
        xa.sum += p;
        xa.count += 1;
      }

      const stream = c?.section ? String(c.section).trim() : null;
      if (stream) {
        if (!camp.streamAgg.has(stream)) camp.streamAgg.set(stream, { sum: 0, count: 0, students: new Set() });
        const st = camp.streamAgg.get(stream);
        st.sum += p;
        st.count += 1;
        st.students.add(r.student_id);
      }
    }

    const subjectSet = new Set();
    const campuses = schoolIds.map((sid) => {
      const meta = schoolMap.get(sid) || { school_id: sid, name: "Campus " + sid };
      const camp = byCampus.get(sid);
      const scores = [...camp.studentAgg.values()].filter((a) => a.count > 0).map((a) => a.sum / a.count);
      const mean = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
      const subjects = {};
      for (const [subj, a] of camp.subjectAgg.entries()) {
        subjectSet.add(subj);
        subjects[subj] = a.count ? Number((a.sum / a.count).toFixed(1)) : null;
      }
      const streams = {};
      for (const [stream, a] of camp.streamAgg.entries()) {
        streams[stream] = {
          mean: a.count ? Number((a.sum / a.count).toFixed(1)) : null,
          student_count: a.students.size,
          entries: a.count,
        };
      }
      return {
        school_id: sid,
        name: meta.name,
        code: meta.code || null,
        branch_code: meta.branch_code || null,
        is_branch: !!meta.is_branch,
        parent_school_id: meta.parent_school_id || null,
        role_in_group: meta.is_branch ? "branch" : "parent",
        mean,
        student_count: scores.length,
        subjects,
        streams,
      };
    });

    campuses.sort((a, b) => {
      if (a.is_branch !== b.is_branch) return a.is_branch ? 1 : -1;
      return String(a.name).localeCompare(String(b.name));
    });

    const subjects = [...subjectSet].sort();
    const subjectMatrix = {};
    for (const subj of subjects) {
      subjectMatrix[subj] = {};
      for (const c of campuses) subjectMatrix[subj][c.school_id] = c.subjects[subj] ?? null;
    }

    const parent = campuses.find((c) => !c.is_branch) || campuses[0] || null;
    const comparison = campuses.map((c) => ({
      school_id: c.school_id,
      name: c.name,
      mean: c.mean,
      gap_vs_parent: parent && parent.mean != null && c.mean != null ? Number((c.mean - parent.mean).toFixed(1)) : null,
      student_count: c.student_count,
    }));

    res.json({
      campuses,
      comparison,
      subjects,
      subjectMatrix,
      meta: {
        term,
        class_name: className,
        campus_count: campuses.length,
        parent_school_id: parent?.school_id || null,
        role,
      },
    });
  } catch (err) {
    next(err);
  }
});

`;

if (!t.includes("export default router")) {
  console.error("export default router not found");
  process.exit(1);
}
t = t.replace(/\nexport default router;\s*$/, "\n" + endpoint + "\nexport default router;\n");
fs.writeFileSync(path, t);
console.log("applied branch-compare analysis endpoint");
