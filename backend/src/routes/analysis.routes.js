import { Router } from "express";
// OLD: import { pgPool } from "../config/pg.js";
import { authRequired } from "../middleware/auth.js";
import { env } from "../config/env.js";
// OLD: import { supabase } from "../config/db.js";
import { supabase } from "../config/supabaseClient.js";

const router = Router();

// OLD: async function sq(sql, params = []) { ... pgPool.query ... }

// GET /api/analysis/streams
router.get("/streams", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term || "Term 2";
    const className = req.query.class_name || null;

    // Pull the minimal raw rows and aggregate in JS.
    // This avoids pgPool + auth.jwt() failures (Tenant or user not found).
    const { data: resultRows, error: resultsErr } = await supabase
      .from("results")
      .select("result_id,school_id,term,subject,marks,total_marks,student_id,class_id,is_deleted")
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("is_deleted", false)
      .not("class_id", "is", null);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((resultRows || []).map(r => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((resultRows || []).map(r => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      classIds.length
        ? supabase.from("classes").select("class_id,class_name,section,is_deleted,status").in("class_id", classIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? supabase.from("students").select("student_id,is_deleted,status").in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesErr) throw classesErr;
    if (studentsErr) throw studentsErr;

    const classById = new Map((classesRows || []).map(c => [c.class_id, c]));
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

    const cleanRows = (resultRows || []).filter(r => {
      const c = pickClass(r.class_id);
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
      const c = classById.get(r.class_id);
      if (!c) continue;
      const p = pct(r);
      if (p == null) continue;
      const key = c.class_id;
      if (!streamAgg.has(key)) {
        streamAgg.set(key, {
          class_name: c.class_name,
          stream: c.section,
          stream_label: `${c.class_name} ${c.section}`,
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
    const streamAvgs = [...streamAgg.values()]
      .map(a => ({
        class_name: a.class_name,
        stream: a.stream,
        stream_label: a.stream_label,
        class_id: a.class_id,
        student_count: a.studentIds.size,
        avg_score: a.count ? Number((a.sum / a.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => String(a.class_name).localeCompare(String(b.class_name)) || String(a.stream).localeCompare(String(b.stream)));

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
      const c = classById.get(r.class_id);
      if (!c) continue;
      const subject = String(r.subject || "").trim();
      if (!subject) continue;
      const p = pct(r);
      if (p == null) continue;
      const streamLabel = `${c.class_name} ${c.section}`;
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
      .eq("is_deleted", false)
      .not("class_id", "is", null);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((resultsRows || []).map(r => r.class_id).filter(Boolean))];
    const { data: classesRows, error: classesErr } = classIds.length
      ? await supabase.from("classes").select("class_id,class_name,is_deleted,status").in("class_id", classIds)
      : { data: [], error: null };
    if (classesErr) throw classesErr;
    const classById = new Map((classesRows || []).map(c => [c.class_id, c]));

    const cleanRows = (resultsRows || []).filter(r => {
      const c = classById.get(r.class_id);
      if (!c || c.is_deleted || c.status !== "active") return false;
      if (className && c.class_name !== className) return false;
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
      .eq("is_deleted", false)
      .not("class_id", "is", null);
    if (resultsErr) throw resultsErr;

    const classIds = [...new Set((raw || []).map(r => r.class_id).filter(Boolean))];
    const studentIds = [...new Set((raw || []).map(r => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      classIds.length
        ? supabase.from("classes").select("class_id,class_name,section,is_deleted,status").in("class_id", classIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? supabase.from("students").select("student_id,first_name,last_name,admission_number,is_deleted,status").in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesErr) throw classesErr;
    if (studentsErr) throw studentsErr;

    const classById = new Map((classesRows || []).map(c => [c.class_id, c]));
    const studentById = new Map((studentsRows || []).map(s => [s.student_id, s]));

    const pct = (r) => {
      const denom = Number(r.total_marks || 0);
      if (!denom) return null;
      return (Number(r.marks || 0) / denom) * 100;
    };

    const cleanRows = (raw || []).filter(r => {
      if (term && r.term !== term) return false;
      const c = classById.get(r.class_id);
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
      if (!studentAgg.has(r.student_id)) studentAgg.set(r.student_id, { sum: 0, count: 0, subjects: new Set(), class_id: r.class_id });
      const a = studentAgg.get(r.student_id);
      a.sum += p;
      a.count += 1;
      if (r.subject) a.subjects.add(r.subject);
      a.class_id = r.class_id || a.class_id;
    }

    const scored = [...studentAgg.entries()]
      .map(([student_id, a]) => {
        const s = studentById.get(student_id) || {};
        const c = classById.get(a.class_id) || {};
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

export default router;