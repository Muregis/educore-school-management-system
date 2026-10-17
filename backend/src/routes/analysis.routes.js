import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { supabase } from "../config/supabaseClient.js";
import { getAccessibleSchoolIds, getSchoolWithBranches } from "../services/branch.service.js";

const router = Router();

function classKey(name) {
  return String(name || "").trim().toLowerCase();
}

// GET /api/analysis/streams
router.get("/streams", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term;
    const className = req.query.class_name || null;

    if (!term) {
      return res.status(400).json({ error: "Term parameter is required" });
    }

    // Pull the minimal raw rows and aggregate in JS.
    // This avoids pgPool + auth.jwt() failures (Tenant or user not found).
    const { data: resultRows, error: resultsErr } = await supabase
      .from("results")
      .select("result_id,school_id,term,subject,marks,total_marks,student_id,class_id,is_deleted")
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("is_deleted", false);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((resultRows || []).map(r => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((resultRows || []).map(r => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase.from("classes").select("class_id,class_name,section,is_deleted,status,school_id")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .eq("status", "active"),
      studentIds.length
        ? supabase.from("students").select("student_id,class_name,is_deleted,status").eq("school_id", schoolId).in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesErr) throw classesErr;
    if (studentsErr) throw studentsErr;

    const classById = new Map((classesRows || []).map(c => [c.class_id, c]));
    const classByName = new Map((classesRows || []).map(c => [classKey(c.class_name), c]));
    const studentById = new Map((studentsRows || []).map(s => [s.student_id, s]));

    const isActiveStudent = (sid) => {
      const s = studentById.get(sid);
      return s && !s.is_deleted && s.status === "active";
    };

    const pickClass = (cid) => {
      const c = classById.get(cid);
      if (!c || c.is_deleted || c.status !== "active") return null;
      if (className && c.class_name !== className) return null;
      return c;
    };

    const pickResultClass = (r) => {
      const c = pickClass(r.class_id) || classByName.get(classKey(studentById.get(r.student_id)?.class_name));
      if (!c || (className && c.class_name !== className)) return null;
      return c;
    };

    const cleanRows = (resultRows || []).filter(r => {
      const c = pickResultClass(r);
      if (!c) return false;
      if (!isActiveStudent(r.student_id)) return false;
      return true;
    });

    const pct = (r) => {
      const denom = Number(r.total_marks || 0);
      if (!denom) return null;
      return (Number(r.marks || 0) / denom) * 100;
    };

    // Stream averages
    const streamAgg = new Map(); // class_id -> { class_name, stream, stream_label, class_id, studentIds:Set, sum, count }
    for (const r of cleanRows) {
      const c = pickResultClass(r);
      if (!c) continue;
      const p = pct(r);
      if (p == null) continue;
      const key = c.class_id;
      if (!streamAgg.has(key)) {
        streamAgg.set(key, {
          class_name: c.class_name,
          stream: c.section,
          stream_label: (c.section ? `${c.class_name} ${String(c.section).trim()}` : String(c.class_name || "")),
          class_id: c.class_id,
          studentIds: new Set(),
          sum: 0,
          count: 0,
        });
      }
      const a = streamAgg.get(key);
      a.studentIds.add(r.student_id);
      a.sum += p;
      a.count += 1;
    }
// Official CBC class order: Playgroup → Grade 9 (not alphabetical)
const CLASS_ORDER = ["Playgroup","PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
const classOrderIndex = (name) => {
  const i = CLASS_ORDER.indexOf(name);
  return i === -1 ? 99 : i; // unknown classes sort last
};

    const streamAvgs = [...streamAgg.values()]
      .map(a => ({
        class_name: a.class_name,
        stream: a.stream,
        stream_label: a.stream_label,
        class_id: a.class_id,
        student_count: a.studentIds.size,
        avg_score: a.count ? Number((a.sum / a.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => classOrderIndex(a.class_name) - classOrderIndex(b.class_name) || String(a.stream).localeCompare(String(b.stream)));


    // Subject rankings
    const subjAgg = new Map(); // subject -> { sum,count,highest,lowest,entries }
    for (const r of cleanRows) {
      const s = String(r.subject || "").trim();
      if (!s) continue;
      const p = pct(r);
      if (p == null) continue;
      if (!subjAgg.has(s)) subjAgg.set(s, { sum: 0, count: 0, highest: p, lowest: p, entries: 0 });
      const a = subjAgg.get(s);
      a.sum += p;
      a.count += 1;
      a.entries += 1;
      if (p > a.highest) a.highest = p;
      if (p < a.lowest) a.lowest = p;
    }
    const subjectAvgs = [...subjAgg.entries()]
      .map(([subject, a]) => ({
        subject,
        avg_score: a.count ? Number((a.sum / a.count).toFixed(1)) : 0,
        highest: Number(a.highest.toFixed(1)),
        lowest: Number(a.lowest.toFixed(1)),
        entries: a.entries,
      }))
      .sort((a, b) => b.avg_score - a.avg_score);

    // Stream vs subject matrix
    const matrixAgg = new Map(); // stream_label -> subject -> {sum,count}
    const streamMeta = new Map(); // stream_label -> {class_name, stream}
    for (const r of cleanRows) {
      const c = pickResultClass(r);
      if (!c) continue;
      const subject = String(r.subject || "").trim();
      if (!subject) continue;
      const p = pct(r);
      if (p == null) continue;
      const streamLabel = c.section ? `${c.class_name} ${String(c.section).trim()}` : String(c.class_name || "");
      if (!matrixAgg.has(streamLabel)) matrixAgg.set(streamLabel, new Map());
      if (!streamMeta.has(streamLabel)) streamMeta.set(streamLabel, { class_name: c.class_name, stream: c.section });
      const bySubj = matrixAgg.get(streamLabel);
      if (!bySubj.has(subject)) bySubj.set(subject, { sum: 0, count: 0 });
      const a = bySubj.get(subject);
      a.sum += p;
      a.count += 1;
    }
    const allSubjects = [...new Set(subjectAvgs.map(s => s.subject))].sort();
    const matrix = {};
    for (const [streamLabel, bySubj] of matrixAgg.entries()) {
      const meta = streamMeta.get(streamLabel) || {};
      matrix[streamLabel] = { ...meta };
      for (const subj of allSubjects) {
        const a = bySubj.get(subj);
        if (!a || !a.count) continue;
        matrix[streamLabel][subj] = Number((a.sum / a.count).toFixed(1));
      }
    }

    // Available terms/classes
    const [{ data: termRows, error: termsErr }, { data: classNameRows, error: classNamesErr }] = await Promise.all([
      supabase
        .from("results")
        .select("term")
        .eq("school_id", schoolId)
        .eq("is_deleted", false),
      supabase
        .from("classes")
        .select("class_name")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .eq("status", "active"),
    ]);
    if (termsErr) throw termsErr;
    if (classNamesErr) throw classNamesErr;
    const terms = [...new Set((termRows || []).map(t => t.term).filter(Boolean))].sort();
    const classes = [...new Set((classNameRows || []).map(c => c.class_name).filter(Boolean))].sort();

    res.json({
      streamAverages:  streamAvgs.map(r => ({ ...r, avg_score: Number(r.avg_score) })),
      subjectRankings: subjectAvgs.map(r => ({ ...r, avg_score: Number(r.avg_score), highest: Number(r.highest), lowest: Number(r.lowest) })),
      streamVsSubject: { streams: Object.keys(matrix), subjects: allSubjects, data: matrix },
      terms,
      classes,
      meta:    { term, class_name: className },
    });
  } catch (err) { next(err); }
});

// POST /api/analysis/ai-report  — proxies to Anthropic (no authRequired so body parses correctly)
router.post("/ai-report", async (req, res, next) => {
  try {
    console.log("[ai-report] body:", JSON.stringify(req.body).slice(0, 100));

    const apiKey = env.groqApiKey || process.env.GROQ_API_KEY;
    console.log("[ai-report] apiKey present:", !!apiKey, "env.groqApiKey:", env.groqApiKey ? "set" : "EMPTY", "process.env:", process.env.GROQ_API_KEY ? "set" : "EMPTY");
    if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not configured" });

    const { prompt } = req.body || {};
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: "prompt required", body: req.body });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "llama-3.1-8b-instant",
        max_tokens:  1800,
        temperature: 0.4,
        messages:    [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[ai-report] Groq error:", data);
      return res.status(response.status).json(data);
    }

    const text = data.choices?.[0]?.message?.content || "";
    res.json({ text });
  } catch (err) {
    console.error("[ai-report] error:", err);
    next(err);
  }
});


// GET /api/analysis/trends?class_name=Grade+7
// Returns avg score per subject per term — for trend charts
router.get("/trends", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const className = req.query.class_name || null;

    const { data: resultsRows, error: resultsErr } = await supabase
      .from("results")
      .select("term,subject,marks,total_marks,student_id,class_id,is_deleted,school_id")
      .eq("school_id", schoolId)
      .eq("is_deleted", false);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((resultsRows || []).map(r => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((resultsRows || []).map(r => r.student_id).filter(Boolean))];
    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase.from("classes").select("class_id,class_name,is_deleted,status")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .eq("status", "active"),
      studentIds.length
        ? supabase.from("students").select("student_id,class_name,is_deleted,status").eq("school_id", schoolId).in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesErr) throw classesErr;
    if (studentsErr) throw studentsErr;
    const classById = new Map((classesRows || []).map(c => [c.class_id, c]));
    const classByName = new Map((classesRows || []).map(c => [classKey(c.class_name), c]));
    const studentById = new Map((studentsRows || []).map(s => [s.student_id, s]));
    const getClass = (r) => classById.get(r.class_id) || classByName.get(classKey(studentById.get(r.student_id)?.class_name));

    const cleanRows = (resultsRows || []).filter(r => {
      const c = getClass(r);
      if (!c || c.is_deleted || c.status !== "active") return false;
      if (className && c.class_name !== className) return false;
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted || s.status !== "active") return false;
      return true;
    });

    const pct = (r) => {
      const denom = Number(r.total_marks || 0);
      if (!denom) return null;
      return (Number(r.marks || 0) / denom) * 100;
    };

    const byTermSubject = new Map(); // `${term}||${subject}` -> { sum,count,studentIds:Set }
    const byTerm = new Map(); // term -> { sum,count,studentIds:Set }
    for (const r of cleanRows) {
      const t = String(r.term || "").trim();
      const s = String(r.subject || "").trim();
      if (!t || !s) continue;
      const p = pct(r);
      if (p == null) continue;
      const key = `${t}||${s}`;
      if (!byTermSubject.has(key)) byTermSubject.set(key, { term: t, subject: s, sum: 0, count: 0, studentIds: new Set() });
      const a = byTermSubject.get(key);
      a.sum += p;
      a.count += 1;
      a.studentIds.add(r.student_id);

      if (!byTerm.has(t)) byTerm.set(t, { term: t, sum: 0, count: 0, studentIds: new Set() });
      const o = byTerm.get(t);
      o.sum += p;
      o.count += 1;
      o.studentIds.add(r.student_id);
    }

    const rows = [...byTermSubject.values()].map(a => ({
      term: a.term,
      subject: a.subject,
      avg_score: a.count ? Number((a.sum / a.count).toFixed(1)) : 0,
      student_count: a.studentIds.size,
    }));

    const overallRows = [...byTerm.values()].map(a => ({
      term: a.term,
      avg_score: a.count ? Number((a.sum / a.count).toFixed(1)) : 0,
      student_count: a.studentIds.size,
    }));

    // Build: { terms: [...], subjects: [...], data: { subject: { term: avg } } }
    const terms    = [...new Set(rows.map(r => r.term))].sort();
    const subjects = [...new Set(rows.map(r => r.subject))].sort();
    const data = {};
    for (const row of rows) {
      if (!data[row.subject]) data[row.subject] = {};
      data[row.subject][row.term] = Number(row.avg_score);
    }

    res.json({
      terms,
      subjects,
      data,
      overall: overallRows.map(r => ({ term: r.term, avg_score: Number(r.avg_score), student_count: Number(r.student_count) })),
    });
  } catch (err) { next(err); }
});

// GET /api/analysis/top-students?term=Term+2&class_name=Grade+7&limit=10
// Returns top N students by average score
router.get("/top-students", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term      = req.query.term       || null;
    const className = req.query.class_name || null;
    const limit     = Math.min(parseInt(req.query.limit) || 10, 20);

    const { data: raw, error: resultsErr } = await supabase
      .from("results")
      .select("term,subject,marks,total_marks,student_id,class_id,is_deleted,school_id")
      .eq("school_id", schoolId)
      .eq("is_deleted", false);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((raw || []).map(r => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((raw || []).map(r => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase.from("classes").select("class_id,class_name,section,is_deleted,status")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .eq("status", "active"),
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

    const cleanRows = (raw || []).filter(r => {
      if (term && r.term !== term) return false;
      const c = getClass(r);
      if (!c || c.is_deleted || c.status !== "active") return false;
      if (className && c.class_name !== className) return false;
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted || s.status !== "active") return false;
      return true;
    });

    // Aggregate per student
    const studentAgg = new Map(); // student_id -> { sum,count,subjects:Set, class_id }
    for (const r of cleanRows) {
      const p = pct(r);
      if (p == null) continue;
      if (!studentAgg.has(r.student_id)) studentAgg.set(r.student_id, { sum: 0, count: 0, subjects: new Set(), class_id: r.class_id, class_ref: getClass(r) });
      const a = studentAgg.get(r.student_id);
      a.sum += p;
      a.count += 1;
      if (r.subject) a.subjects.add(r.subject);
      a.class_id = r.class_id || a.class_id;
      a.class_ref = getClass(r) || a.class_ref;
    }

    const scored = [...studentAgg.entries()]
      .map(([student_id, a]) => {
        const s = studentById.get(student_id) || {};
        const c = a.class_ref || classById.get(a.class_id) || classByName.get(classKey(s.class_name)) || {};
        return {
          student_id,
          first_name: s.first_name,
          last_name: s.last_name,
          admission_number: s.admission_number,
          class_name: c.class_name,
          stream: c.section,
          stream_label: c.class_name && c.section ? `${c.class_name} ${c.section}` : "",
          avg_score: a.count ? Number((a.sum / a.count).toFixed(1)) : 0,
          subjects_sat: a.subjects.size,
        };
      })
      .filter(r => r.subjects_sat >= 3)
      .sort((a, b) => b.avg_score - a.avg_score);

    const rows = scored.slice(0, limit);

    // Per-class top 5
    const byClassMap = new Map(); // class_name -> students[]
    for (const r of scored) {
      if (!r.class_name) continue;
      if (!byClassMap.has(r.class_name)) byClassMap.set(r.class_name, []);
      const arr = byClassMap.get(r.class_name);
      if (arr.length < 5) arr.push(r);
    }
    const byClassRows = [...byClassMap.entries()]
      .flatMap(([class_name, arr]) => arr.map((r, idx) => ({ ...r, class_name, class_rank: idx + 1 })))
      .sort((a, b) => String(a.class_name).localeCompare(String(b.class_name)) || a.class_rank - b.class_rank);

    res.json({
      overall: rows.map((r, i) => ({ ...r, rank: i + 1, avg_score: Number(r.avg_score) })),
      byClass: byClassRows.map(r => ({ ...r, avg_score: Number(r.avg_score), rank: Number(r.class_rank) })),
    });
  } catch (err) { next(err); }
});

// GET /api/analysis/student-rankings?term=Term+2&class_name=Grade+7
// Returns all students in a class with their positions, total marks, and averages
router.get("/student-rankings", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term;
    const className = req.query.class_name || null;

    if (!term) {
      return res.status(400).json({ error: "Term parameter is required" });
    }

    const { data: raw, error: resultsErr } = await supabase
      .from("results")
      .select("term,subject,marks,total_marks,student_id,class_id,is_deleted,school_id")
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("is_deleted", false);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((raw || []).map(r => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((raw || []).map(r => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase.from("classes").select("class_id,class_name,section,is_deleted,status")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .eq("status", "active"),
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

    const cleanRows = (raw || []).filter(r => {
      const c = getClass(r);
      if (!c || c.is_deleted || c.status !== "active") return false;
      if (className && c.class_name !== className) return false;
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted || s.status !== "active") return false;
      return true;
    });

    // Aggregate per student
    const studentAgg = new Map(); // student_id -> { sum,count,totalMarks,subjects:Set, class_id, subjectScores }
    for (const r of cleanRows) {
      const p = pct(r);
      if (p == null) continue;
      if (!studentAgg.has(r.student_id)) studentAgg.set(r.student_id, { sum: 0, count: 0, totalMarks: 0, subjects: new Set(), class_id: r.class_id, class_ref: getClass(r), subjectScores: new Map() });
      const a = studentAgg.get(r.student_id);
      a.sum += p;
      a.count += 1;
      a.totalMarks += Number(r.marks || 0);
      if (r.subject) {
        a.subjects.add(r.subject);
        a.subjectScores.set(r.subject, { marks: r.marks, total: r.total_marks, percentage: p });
      }
      a.class_id = r.class_id || a.class_id;
      a.class_ref = getClass(r) || a.class_ref;
    }

    const scored = [...studentAgg.entries()]
      .map(([student_id, a]) => {
        const s = studentById.get(student_id) || {};
        const c = a.class_ref || classById.get(a.class_id) || classByName.get(classKey(s.class_name)) || {};
        return {
          student_id,
          first_name: s.first_name,
          last_name: s.last_name,
          admission_number: s.admission_number,
          class_name: c.class_name,
          stream: c.section,
          stream_label: c.class_name && c.section ? `${c.class_name} ${c.section}` : "",
          avg_score: a.count ? Number((a.sum / a.count).toFixed(1)) : 0,
          total_marks: a.totalMarks,
          subjects_sat: a.subjects.size,
          subject_scores: Object.fromEntries(a.subjectScores),
        };
      })
      .sort((a, b) => b.avg_score - a.avg_score);

    // Assign positions with tie handling
    let currentRank = 1;
    let prevScore = null;
    const ranked = scored.map((s, idx) => {
      if (prevScore !== null && s.avg_score < prevScore - 0.01) {
        currentRank = idx + 1;
      }
      prevScore = s.avg_score;
      return { ...s, position: currentRank };
    });

    // Group by class
    const byClass = new Map();
    for (const r of ranked) {
      if (!r.class_name) continue;
      if (!byClass.has(r.class_name)) byClass.set(r.class_name, []);
      byClass.get(r.class_name).push(r);
    }

    res.json({
      all_students: ranked,
      by_class: Object.fromEntries(byClass),
      meta: { term, class_name: className },
    });
  } catch (err) { next(err); }
});

// GET /api/analysis/class-stats?term=Term+2&class_name=Grade+7
// Returns comprehensive class statistics: mean, median, subject breakdowns, grade distribution
router.get("/class-stats", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term;
    const className = req.query.class_name || null;

    if (!term) {
      return res.status(400).json({ error: "Term parameter is required" });
    }

    const { data: raw, error: resultsErr } = await supabase
      .from("results")
      .select("term,subject,marks,total_marks,student_id,class_id,is_deleted,school_id,grade")
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("is_deleted", false);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((raw || []).map(r => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((raw || []).map(r => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase.from("classes").select("class_id,class_name,section,is_deleted,status")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .eq("status", "active"),
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

    const cleanRows = (raw || []).filter(r => {
      const c = getClass(r);
      if (!c || c.is_deleted || c.status !== "active") return false;
      if (className && c.class_name !== className) return false;
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted || s.status !== "active") return false;
      return true;
    });

    // Aggregate per student
    const studentAgg = new Map();
    for (const r of cleanRows) {
      const p = pct(r);
      if (p == null) continue;
      if (!studentAgg.has(r.student_id)) studentAgg.set(r.student_id, { sum: 0, count: 0, class_id: r.class_id, class_ref: getClass(r) });
      const a = studentAgg.get(r.student_id);
      a.sum += p;
      a.count += 1;
      a.class_id = r.class_id || a.class_id;
      a.class_ref = getClass(r) || a.class_ref;
    }

    const studentScores = [...studentAgg.values()]
      .map(a => a.count ? a.sum / a.count : 0)
      .filter(s => s > 0)
      .sort((a, b) => a - b);

    // Calculate statistics
    const mean = studentScores.length ? Number((studentScores.reduce((a, b) => a + b, 0) / studentScores.length).toFixed(1)) : 0;
    const median = studentScores.length ? (
      studentScores.length % 2 === 0
        ? Number(((studentScores[studentScores.length / 2 - 1] + studentScores[studentScores.length / 2]) / 2).toFixed(1))
        : Number(studentScores[Math.floor(studentScores.length / 2)].toFixed(1))
    ) : 0;
    const highest = studentScores.length ? Number(studentScores[studentScores.length - 1].toFixed(1)) : 0;
    const lowest = studentScores.length ? Number(studentScores[0].toFixed(1)) : 0;

    // Subject breakdowns per class
    const subjectByClass = new Map(); // class_name -> { subject -> { sum, count, grades } }
    for (const r of cleanRows) {
      const c = getClass(r);
      if (!c) continue;
      const subject = String(r.subject || "").trim();
      if (!subject) continue;
      const p = pct(r);
      if (p == null) continue;

      const key = c.class_name;
      if (!subjectByClass.has(key)) subjectByClass.set(key, new Map());
      const bySubj = subjectByClass.get(key);
      if (!bySubj.has(subject)) bySubj.set(subject, { sum: 0, count: 0, grades: [], subs: [] });
      const a = bySubj.get(subject);
      a.sum += p;
      a.count += 1;
      const pBand = (v) => {
        if (v >= 90) return { sub: "EE1", parent: "EE" };
        if (v >= 80) return { sub: "EE2", parent: "EE" };
        if (v >= 70) return { sub: "ME1", parent: "ME" };
        if (v >= 65) return { sub: "ME2", parent: "ME" };
        if (v >= 55) return { sub: "AE1", parent: "AE" };
        if (v >= 50) return { sub: "AE2", parent: "AE" };
        if (v >= 40) return { sub: "BE1", parent: "BE" };
        return { sub: "BE2", parent: "BE" };
      };
      const band = pBand(p);
      a.grades.push(band.parent);
      a.subs.push(band.sub);
    }

    const subjectStats = {};
    for (const [className, bySubj] of subjectByClass.entries()) {
      subjectStats[className] = {};
      for (const [subject, data] of bySubj.entries()) {
        const gradeCounts = {};
        const subCounts = {};
        (data.grades || []).forEach(g => { gradeCounts[g] = (gradeCounts[g] || 0) + 1; });
        (data.subs || []).forEach(g => { subCounts[g] = (subCounts[g] || 0) + 1; });
        const subMean = Number((data.sum / data.count).toFixed(1));
        const pBand = (v) => v >= 90 ? "EE1" : v >= 80 ? "EE2" : v >= 70 ? "ME1" : v >= 65 ? "ME2" : v >= 55 ? "AE1" : v >= 50 ? "AE2" : v >= 40 ? "BE1" : "BE2";
        subjectStats[className][subject] = {
          mean: subMean,
          mean_sub_level: pBand(subMean),
          entries: data.count,
          grade_distribution: gradeCounts,
          sub_level_distribution: subCounts,
        };
      }
    }

    const gradeCounts = {};
    const subLevelCounts = {};
    const pBandFull = (v) => {
      if (v >= 90) return { sub: "EE1", parent: "EE" };
      if (v >= 80) return { sub: "EE2", parent: "EE" };
      if (v >= 70) return { sub: "ME1", parent: "ME" };
      if (v >= 65) return { sub: "ME2", parent: "ME" };
      if (v >= 55) return { sub: "AE1", parent: "AE" };
      if (v >= 50) return { sub: "AE2", parent: "AE" };
      if (v >= 40) return { sub: "BE1", parent: "BE" };
      return { sub: "BE2", parent: "BE" };
    };
    cleanRows.forEach(r => {
      const p = pct(r);
      if (p == null) return;
      const b = pBandFull(p);
      gradeCounts[b.parent] = (gradeCounts[b.parent] || 0) + 1;
      subLevelCounts[b.sub] = (subLevelCounts[b.sub] || 0) + 1;
    });
    const meanSub = mean > 0 ? pBandFull(mean).sub : "-";

    res.json({
      overall: {
        mean,
        mean_sub_level: meanSub,
        median,
        highest,
        lowest,
        student_count: studentScores.length,
        grade_distribution: gradeCounts,
        sub_level_distribution: subLevelCounts,
      },
      by_class: subjectStats,
      meta: { term, class_name: className },
    });
  } catch (err) { next(err); }
});


router.get("/merit", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term;
    const className = req.query.class_name ? String(req.query.class_name).trim() : null;
    const streamFilter = req.query.stream ? String(req.query.stream).trim() : null;
    if (!term) return res.status(400).json({ error: "Term parameter is required" });

    const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

    let raw = [];
    {
      const primary = await supabase
        .from("results")
        .select("term,subject,marks,total_marks,student_id,class_id,is_deleted,school_id")
        .eq("school_id", schoolId)
        .eq("term", term);
      if (primary.error) {
        const fb = await supabase
          .from("results")
          .select("term,subject,marks,total_marks,student_id,school_id")
          .eq("school_id", schoolId)
          .eq("term", term);
        if (fb.error) throw fb.error;
        raw = (fb.data || []).map((r) => ({ ...r, is_deleted: false, class_id: null }));
      } else {
        raw = (primary.data || []).filter((r) => r.is_deleted !== true);
      }
    }

    const studentIds = [...new Set(raw.map((r) => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase
        .from("classes")
        .select("class_id,class_name,section,is_deleted,status")
        .eq("school_id", schoolId),
      studentIds.length
        ? supabase
            .from("students")
            .select("student_id,first_name,last_name,admission_number,class_name,is_deleted,status")
            .eq("school_id", schoolId)
            .in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesErr) throw classesErr;
    if (studentsErr) throw studentsErr;

    const activeClasses = (classesRows || []).filter(
      (c) => c.is_deleted !== true && (c.status == null || c.status === "active")
    );
    const classById = new Map(activeClasses.map((c) => [c.class_id, c]));
    const classByName = new Map(activeClasses.map((c) => [classKey(c.class_name), c]));
    const studentById = new Map((studentsRows || []).map((s) => [s.student_id, s]));

    const getClass = (r) => {
      if (r.class_id && classById.has(r.class_id)) return classById.get(r.class_id);
      const s = studentById.get(r.student_id);
      if (!s) return null;
      const byName = classByName.get(classKey(s.class_name));
      if (byName) return byName;
      const full = String(s.class_name || "").trim();
      if (!full) return null;
      return { class_id: null, class_name: full, section: null, is_deleted: false, status: "active", _synthetic: true };
    };

    const matchesClassFilter = (c, s) => {
      if (!className) return true;
      const want = norm(className);
      const cn = norm(c?.class_name);
      const sn = norm(s?.class_name);
      if (cn === want || sn === want) return true;
      if (cn.startsWith(want + " ") || sn.startsWith(want + " ")) return true;
      return false;
    };

    const matchesStream = (c, s) => {
      if (!streamFilter) return true;
      const want = norm(streamFilter);
      const sec = norm(c?.section);
      if (sec && sec === want) return true;
      const label = norm(c?.class_name || s?.class_name);
      if (label.endsWith(" " + want) || label === want) return true;
      return false;
    };

    const pct = (r) => {
      let denom = Number(r.total_marks || 0);
      const marks = Number(r.marks);
      if (!Number.isFinite(marks) || marks < 0) return null;
      if (!denom || denom <= 0) denom = 100;
      return (marks / denom) * 100;
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

    const cleanRows = raw.filter((r) => {
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted === true) return false;
      if (s.status && s.status !== "active") return false;
      const c = getClass(r);
      if (!matchesClassFilter(c, s)) return false;
      if (!matchesStream(c || {}, s)) return false;
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
        studentAgg.set(r.student_id, {
          sum: 0, count: 0, totalMarks: 0,
          class_id: r.class_id, class_ref: getClass(r), subjects: {},
        });
      }
      const a = studentAgg.get(r.student_id);
      a.sum += p; a.count += 1; a.totalMarks += Number(r.marks || 0);
      const sl = subLevel(p);
      a.subjects[subj] = {
        marks: Number(r.marks || 0),
        total: Number(r.total_marks || 100),
        percentage: Number(p.toFixed(1)),
        sub_level: sl.grade,
        grade: sl.parent,
      };
      a.class_ref = getClass(r) || a.class_ref;
    }

    const subjects = [...subjectSet].sort((a, b) => a.localeCompare(b));
    const scored = [...studentAgg.entries()]
      .map(([student_id, a]) => {
        const s = studentById.get(student_id) || {};
        const c = a.class_ref || classById.get(a.class_id) || {};
        const average = a.count ? Number((a.sum / a.count).toFixed(2)) : 0;
        const overall = subLevel(average);
        const streamLabel =
          c.class_name && c.section
            ? `${c.class_name} ${c.section}`
            : c.class_name || s.class_name || "";
        return {
          student_id,
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          admission_number: s.admission_number || null,
          class_name: c.class_name || s.class_name || "",
          stream: c.section || "",
          stream_label: streamLabel,
          total_marks: a.totalMarks,
          average,
          overall_grade: overall.parent,
          overall_sub_level: overall.grade,
          subjects: a.subjects,
          subjects_sat: Object.keys(a.subjects).length,
        };
      })
      .sort((a, b) => b.average - a.average || b.total_marks - a.total_marks);

    let currentRank = 1;
    let prevAvg = null;
    const rows = scored.map((s, idx) => {
      if (prevAvg !== null && s.average < prevAvg - 0.001) currentRank = idx + 1;
      prevAvg = s.average;
      return { ...s, rank: currentRank };
    });

    const streamSet = new Set();
    for (const c of activeClasses) {
      if (className && !matchesClassFilter(c, { class_name: c.class_name })) continue;
      if (c.section) streamSet.add(String(c.section).trim());
    }
    for (const s of studentsRows || []) {
      if (s.is_deleted === true) continue;
      if (!matchesClassFilter({ class_name: s.class_name }, s)) continue;
      const parts = String(s.class_name || "").trim().split(/\s+/);
      if (parts.length >= 2 && className && norm(s.class_name).startsWith(norm(className) + " ")) {
        streamSet.add(parts[parts.length - 1]);
      }
    }
    const streams = [...streamSet].filter(Boolean).sort();

    res.json({
      rows,
      subjects,
      streams,
      meta: {
        term,
        class_name: className,
        stream: streamFilter,
        mode: streamFilter ? "stream" : "consolidated",
        learner_count: rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});



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


export default router;
