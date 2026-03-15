import { Router } from "express";
import { pgPool } from "../config/pg.js";
import { authRequired } from "../middleware/auth.js";
import { env } from "../config/env.js";

const router = Router();

async function sq(sql, params = []) {
  try {
    const { rows } = await pgPool.query(sql, params);
    return rows;
  } catch (err) {
    console.error("SQL error:", err);
    return [];
  }
}

// GET /api/analysis/streams
router.get("/streams", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term || "Term 2";
    const className = req.query.class_name || null;

    const base = "r.school_id=$1 AND r.term=$2 AND r.is_deleted=false AND c.is_deleted=false AND s.is_deleted=false AND s.status='active'";
    const p = [schoolId, term];
    const classFilter = className ? " AND c.class_name=$3" : "";
    if (className) p.push(className);

    const streamAvgs = await sq(
      `SELECT c.class_name, c.section AS stream,
        CONCAT(c.class_name,' ',c.section) AS stream_label, c.class_id,
        COUNT(DISTINCT r.student_id) AS student_count,
        ROUND(AVG(r.marks / r.total_marks * 100), 1) AS avg_score
      FROM results r
      JOIN classes c ON c.class_id = r.class_id
      JOIN students s ON s.student_id = r.student_id
      WHERE ${base}${classFilter}
      GROUP BY c.class_id, c.class_name, c.section
      ORDER BY c.class_name, c.section`, p);

    const sp = [schoolId, term];
    if (className) sp.push(className);
    const subjectAvgs = await sq(
      `SELECT r.subject,
        ROUND(AVG(r.marks / r.total_marks * 100),1) AS avg_score,
        ROUND(MAX(r.marks / r.total_marks * 100),1) AS highest,
        ROUND(MIN(r.marks / r.total_marks * 100),1) AS lowest,
        COUNT(r.result_id) AS entries
      FROM results r
      JOIN classes c ON c.class_id = r.class_id
      WHERE r.school_id=$1 AND r.term=$2 AND r.is_deleted=false AND r.class_id IS NOT NULL
        ${className ? "AND c.class_name=$3" : ""}
      GROUP BY r.subject ORDER BY avg_score DESC`, sp);

    const mp = [schoolId, term];
    if (className) mp.push(className);
    const matrixRaw = await sq(
      `SELECT CONCAT(c.class_name,' ',c.section) AS stream_label,
        c.class_name, c.section AS stream, r.subject,
        ROUND(AVG(r.marks / r.total_marks * 100),1) AS avg_score
      FROM results r
      JOIN classes c ON c.class_id = r.class_id
      WHERE r.school_id=$1 AND r.term=$2 AND r.is_deleted=false AND c.is_deleted=false AND r.class_id IS NOT NULL
        ${className ? "AND c.class_name=$3" : ""}
      GROUP BY c.class_id, c.class_name, c.section, r.subject
      ORDER BY c.class_name, c.section, r.subject`, mp);

    const allSubjects = [...new Set(matrixRaw.map(r => r.subject))].sort();
    const matrix = {};
    for (const row of matrixRaw) {
      if (!matrix[row.stream_label]) matrix[row.stream_label] = { class_name: row.class_name, stream: row.stream };
      matrix[row.stream_label][row.subject] = Number(row.avg_score);
    }

    const terms   = await sq(`SELECT DISTINCT term FROM results WHERE school_id=$1 AND is_deleted=false ORDER BY term`, [schoolId]);
    const classes = await sq(`SELECT DISTINCT class_name FROM classes WHERE school_id=$1 AND is_deleted=false AND status='active' ORDER BY class_name`, [schoolId]);

    res.json({
      streamAverages:  streamAvgs.map(r => ({ ...r, avg_score: Number(r.avg_score) })),
      subjectRankings: subjectAvgs.map(r => ({ ...r, avg_score: Number(r.avg_score), highest: Number(r.highest), lowest: Number(r.lowest) })),
      streamVsSubject: { streams: Object.keys(matrix), subjects: allSubjects, data: matrix },
      terms:   terms.map(t => t.term),
      classes: classes.map(c => c.class_name),
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

    const p = [schoolId];
    if (className) p.push(className);

    const rows = await sq(
      `SELECT r.term, r.subject,
        ROUND(AVG(r.marks / r.total_marks * 100), 1) AS avg_score,
        COUNT(DISTINCT r.student_id) AS student_count
       FROM results r
       JOIN classes c ON c.class_id = r.class_id
       WHERE r.school_id=$1 AND r.is_deleted=false AND c.is_deleted=false
         ${className ? "AND c.class_name=$2" : ""}
       GROUP BY r.term, r.subject
       ORDER BY r.term, r.subject`, p
    );

    // Also get overall avg per term (all subjects combined)
    const overallRows = await sq(
      `SELECT r.term,
        ROUND(AVG(r.marks / r.total_marks * 100), 1) AS avg_score,
        COUNT(DISTINCT r.student_id) AS student_count
       FROM results r
       JOIN classes c ON c.class_id = r.class_id
       WHERE r.school_id=$1 AND r.is_deleted=false AND c.is_deleted=false
         ${className ? "AND c.class_name=$2" : ""}
       GROUP BY r.term
       ORDER BY r.term`, p
    );

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

    const p = [schoolId];
    const filters = ["r.school_id=$1", "r.is_deleted=false", "s.is_deleted=false", "s.status='active'"];
    if (term)      { filters.push("r.term=$2");        p.push(term); }
    if (className) { filters.push("c.class_name=$3");  p.push(className); }

    const rows = await sq(
      `SELECT
        s.student_id,
        s.first_name, s.last_name,
        s.admission_number,
        c.class_name,
        c.section AS stream,
        CONCAT(c.class_name,' ',c.section) AS stream_label,
        ROUND(AVG(r.marks / r.total_marks * 100), 1) AS avg_score,
        COUNT(DISTINCT r.subject) AS subjects_sat
       FROM results r
       JOIN students s ON s.student_id = r.student_id
       JOIN classes  c ON c.class_id   = r.class_id
       WHERE ${filters.join(" AND ")}
       GROUP BY s.student_id, s.first_name, s.last_name, s.admission_number, c.class_name, c.section
       HAVING subjects_sat >= 3
       ORDER BY avg_score DESC
       LIMIT ?`, [...p, limit]
    );

    // Also get per-class top students (top 5 per class)
    const byClassRows = await sq(
      `SELECT
        s.student_id, s.first_name, s.last_name,
        c.class_name,
        CONCAT(c.class_name,' ',c.section) AS stream_label,
        ROUND(AVG(r.marks / r.total_marks * 100), 1) AS avg_score,
        COUNT(DISTINCT r.subject) AS subjects_sat,
        ROW_NUMBER() OVER (PARTITION BY c.class_name ORDER BY AVG(r.marks / r.total_marks * 100) DESC) AS class_rank
       FROM results r
       JOIN students s ON s.student_id = r.student_id
       JOIN classes  c ON c.class_id   = r.class_id
       WHERE ${filters.join(" AND ")}
       GROUP BY s.student_id, s.first_name, s.last_name, c.class_name, c.section
       HAVING subjects_sat >= 3 AND class_rank <= 5
       ORDER BY c.class_name, class_rank`, p
    );

    res.json({
      overall: rows.map((r, i) => ({ ...r, rank: i + 1, avg_score: Number(r.avg_score) })),
      byClass: byClassRows.map(r => ({ ...r, avg_score: Number(r.avg_score), rank: Number(r.class_rank) })),
    });
  } catch (err) { next(err); }
});

export default router;