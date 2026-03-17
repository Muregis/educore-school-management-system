import { Router } from "express";
import { pool }   from "../config/db.js";
import { env }    from "../config/env.js";
import { supabase } from "../config/supabaseClient.js";
import { authRequired }  from "../middleware/auth.js";
import { requireRoles }  from "../middleware/roles.js";
import { logActivity }   from "../helpers/activity.logger.js";

const router = Router();
router.use(authRequired);

function handleLessonPlansDbError(err, res, next) {
  if (err?.code === "ER_NO_SUCH_TABLE") {
    return res.status(500).json({
      message: "Lesson plans table is missing. Run the migration in database/Lesson plans migration.sql and restart the backend.",
    });
  }
  if (err?.code === "ER_BAD_FIELD_ERROR") {
    return res.status(500).json({
      message: "Lesson plans schema mismatch. Re-run database/Lesson plans migration.sql to update your DB schema.",
    });
  }
  return next(err);
}

// ── Shared Groq/AI helper ─────────────────────────────────────────────────────
async function callGroq(prompt, maxTokens = 1200) {
  const apiKey = env.groqApiKey;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: maxTokens,
      temperature: 0.5,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI request failed");
  return data.choices?.[0]?.message?.content || "";
}

// ── GET /api/lesson-plans — list (teacher sees own; admin sees all pending) ───
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;
    const status = req.query.status || null;
    const type   = req.query.type   || null;

    // OLD: const filters = ["p.school_id = ?", "p.is_deleted = false"];
    // OLD: const params  = [schoolId];
    // OLD: ... build SQL join ...
    // OLD: const { data: rows } = await pool.query(`SELECT ...`, params);
    // OLD: res.json(rows);

    let q = supabase
      .from("lesson_plans")
      .select("plan_id,type,subject,class_name,term,week,topic,duration,status,ai_score,created_at,updated_at,reviewed_at,teacher_id,reviewed_by,school_id,is_deleted")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (role === "teacher") q = q.eq("teacher_id", userId);
    if (status) q = q.eq("status", status);
    if (type) q = q.eq("type", type);

    const { data: planRows, error: plansErr } = await q;
    if (plansErr) throw plansErr;

    const userIds = [
      ...new Set(
        (planRows || [])
          .flatMap(p => [p.teacher_id, p.reviewed_by])
          .filter(Boolean)
      ),
    ];

    const { data: usersRows, error: usersErr } = userIds.length
      ? await supabase
          .from("users")
          .select("user_id,full_name,school_id,is_deleted")
          .eq("school_id", schoolId)
          .eq("is_deleted", false)
          .in("user_id", userIds)
      : { data: [], error: null };
    if (usersErr) throw usersErr;

    const userById = new Map((usersRows || []).map(u => [u.user_id, u]));
    const merged = (planRows || []).map(p => ({
      plan_id: p.plan_id,
      type: p.type,
      subject: p.subject,
      class_name: p.class_name,
      term: p.term,
      week: p.week,
      topic: p.topic,
      duration: p.duration,
      status: p.status,
      ai_score: p.ai_score,
      created_at: p.created_at,
      updated_at: p.updated_at,
      reviewed_at: p.reviewed_at,
      teacher_name: userById.get(p.teacher_id)?.full_name || null,
      reviewer_name: userById.get(p.reviewed_by)?.full_name || null,
    }));

    res.json(merged);
  } catch (err) { handleLessonPlansDbError(err, res, next); }
});

// ── GET /api/lesson-plans/:id — single plan with full content ─────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;
    const [[plan]] = await pool.query(
      `SELECT p.*, u.full_name AS teacher_name, r.full_name AS reviewer_name
         FROM lesson_plans p
         JOIN users u ON u.user_id = p.teacher_id
         LEFT JOIN users r ON r.user_id = p.reviewed_by
        WHERE p.plan_id = $1 AND p.school_id = $2 AND p.is_deleted = false`,
      [req.params.id, schoolId]
    );
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    if (role === "teacher" && plan.teacher_id !== userId)
      return res.status(403).json({ message: "Access denied" });
    res.json(plan);
  } catch (err) { handleLessonPlansDbError(err, res, next); }
});

// ── POST /api/lesson-plans/generate — AI generates a draft ───────────────────
router.post("/generate", requireRoles("teacher", "admin"), async (req, res, next) => {
  try {
    const { subject, term, week, topic, duration, type = "lesson_plan", ai_notes } = req.body;
    const className = req.body.class || req.body.class_name;

    if (!subject || !className || !topic) {
      const missing = [
        !subject ? "subject" : null,
        !className ? "class" : null,
        !topic ? "topic" : null,
      ].filter(Boolean);
      return res.status(400).json({
        message: `Missing required field(s): ${missing.join(", ")}`,
      });
    }

    let prompt;
    const notes = typeof ai_notes === "string" ? ai_notes.trim() : "";

    if (type === "scheme") {
      prompt = `You are assisting a teacher in Kenya.

Use the teacher-provided inputs exactly (Subject, Class, Topic focus, Term). Do not change them.

Generate a CBC-compliant Scheme of Work for a full term following the framework used by the Kenya Institute of Curriculum Development (KICD).

Include a weekly breakdown covering:
- Week Number
- Strand
- Sub-Strand
- Specific Learning Outcomes
- Key Inquiry Questions
- Learning Experiences
- Core Competencies
- Assessment Methods
- Learning Resources

Subject: ${subject}
Class: ${className}
Topic focus: ${topic}
Term: ${term || "Term 1"}
Number of Weeks: 12

Format it clearly week by week. Be practical and specific to the Kenyan CBC curriculum.`;
    } else {
      prompt = `You are assisting a teacher in Kenya.

Use the teacher-provided inputs exactly (Subject, Class, Topic, Duration, Term, Week if provided). Do not change them.

Generate a CBC-compliant lesson plan following the framework used by the Kenya Institute of Curriculum Development (KICD).

Include ALL of the following sections with clear headings:

1. Strand
2. Sub-Strand
3. Specific Learning Outcomes
4. Key Inquiry Question
5. Learning Experiences (step-by-step, learner-centered activities)
6. Core Competencies
7. Pertinent and Contemporary Issues (PCIs)
8. Values
9. Assessment (formative, how will you know learners have achieved outcomes)
10. Learning Resources
11. Reflection (space for teacher to fill after lesson)

Subject: ${subject}
Class: ${className}
Topic: ${topic}
Duration: ${duration || "40 minutes"}
Term: ${term || "Term 1"}
${week ? `Week: ${week}` : ""}

Be specific, practical, and ensure activities are learner-centered as required by CBC.`;
    }

    if (notes) {
      prompt += `\n\nTeacher-provided notes / answers (incorporate these details):\n${notes}`;
    }

    const content = await callGroq(prompt, 1400);
    res.json({ content, type });
  } catch (err) { next(err); }
});

// ── POST /api/lesson-plans — save a plan (draft or submit) ────────────────────
router.post("/", requireRoles("teacher", "admin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const {
      type = "lesson_plan", subject, class_name, term, week,
      topic, duration, content, status = "draft",
    } = req.body;

    if (!subject || !class_name || !topic || !content)
      return res.status(400).json({ message: "subject, class_name, topic and content are required" });

    const finalStatus = ["draft", "pending"].includes(status) ? status : "draft";

    const [result] = await pool.query(
      `INSERT INTO lesson_plans
         (school_id, teacher_id, type, subject, class_name, term, week, topic, duration, content, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, userId, type, subject, class_name, term, week || null, topic, duration || null, content, finalStatus]
    );

    logActivity(req, {
      action: `lesson_plan.${finalStatus}`,
      entity: "lesson_plan", entityId: result.insertId,
      description: `${type === "scheme" ? "Scheme of Work" : "Lesson plan"}: ${subject} ${class_name} — ${topic}`,
    });

    res.status(201).json({ planId: result.insertId, status: finalStatus });
  } catch (err) { next(err); }
});

// ── PUT /api/lesson-plans/:id — teacher edits/resubmits ──────────────────────
router.put("/:id", requireRoles("teacher", "admin"), async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;
    const { content, status, subject, class_name, term, week, topic, duration } = req.body;

    const [[plan]] = await pool.query(
      `SELECT * FROM lesson_plans WHERE plan_id=$1 AND school_id=$2 AND is_deleted=false`,
      [req.params.id, schoolId]
    );
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    if (role === "teacher" && plan.teacher_id !== userId)
      return res.status(403).json({ message: "Access denied" });
    if (plan.status === "approved")
      return res.status(400).json({ message: "Approved plans cannot be edited" });

    const newStatus = status === "pending" ? "pending" : "draft";

    await pool.query(
      `UPDATE lesson_plans
          SET content=?, status=?, subject=COALESCE(?,subject), class_name=COALESCE(?,class_name),
              term=COALESCE(?,term), week=COALESCE(?,week), topic=COALESCE(?,topic),
              duration=COALESCE(?,duration),
              ai_score=NULL, ai_missing=NULL, ai_weak=NULL,
              ai_recommendations=NULL, ai_feedback_draft=NULL,
              updated_at=NOW()
        WHERE plan_id=?`,
      [content, newStatus, subject||null, class_name||null, term||null,
       week||null, topic||null, duration||null, req.params.id]
    );

    logActivity(req, {
      action: `lesson_plan.${newStatus === "pending" ? "resubmit" : "edit"}`,
      entity: "lesson_plan", entityId: Number(req.params.id),
      description: `Updated: ${plan.subject} ${plan.class_name}`,
    });

    res.json({ updated: true, status: newStatus });
  } catch (err) { next(err); }
});

// ── POST /api/lesson-plans/:id/analyze — admin runs AI compliance check ───────
router.post("/:id/analyze", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [[plan]] = await pool.query(
      `SELECT * FROM lesson_plans WHERE plan_id=$1 AND school_id=$2 AND is_deleted=false`,
      [req.params.id, schoolId]
    );
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const prompt = `You are reviewing a lesson plan written for a Kenyan school.

Check if it follows the Competency-Based Curriculum (CBC) structure recommended by the Kenya Institute of Curriculum Development (KICD).

Evaluate the lesson plan for:
1. Clear learning outcomes
2. Learner-centered activities
3. Core competency development
4. Assessment methods
5. Teaching resources
6. Alignment with the topic
7. Presence of reflection

LESSON PLAN:
${plan.content}

Respond in EXACTLY this JSON format (no markdown, no extra text):
{
  "score": 84,
  "missing_sections": ["Reflection", "Core Competencies"],
  "weak_areas": ["Learning activities rely mostly on lecture rather than learner participation"],
  "recommendations": ["Add group work activities such as fraction exercises using visual diagrams"],
  "feedback_for_teacher": "Please include a reflection section and incorporate more learner-centered activities."
}`;

    const raw = await callGroq(prompt, 600);

    // Parse JSON — strip any markdown fences
    let analysis;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      analysis = JSON.parse(clean);
    } catch {
      // fallback — extract score with regex
      const scoreMatch = raw.match(/score["\s:]+(\d+)/i);
      analysis = {
        score: scoreMatch ? Number(scoreMatch[1]) : null,
        missing_sections: [],
        weak_areas: [],
        recommendations: [],
        feedback_for_teacher: raw.slice(0, 400),
      };
    }

    await pool.query(
      `UPDATE lesson_plans
          SET ai_score=?, ai_missing=?, ai_weak=?, ai_recommendations=?, ai_feedback_draft=?, updated_at=NOW()
        WHERE plan_id=?`,
      [
        analysis.score ?? null,
        JSON.stringify(analysis.missing_sections || []),
        JSON.stringify(analysis.weak_areas || []),
        JSON.stringify(analysis.recommendations || []),
        analysis.feedback_for_teacher || null,
        req.params.id,
      ]
    );

    res.json({ analysis, planId: Number(req.params.id) });
  } catch (err) { next(err); }
});

// ── POST /api/lesson-plans/:id/approve ────────────────────────────────────────
router.post("/:id/approve", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    await pool.query(
      `UPDATE lesson_plans
          SET status='approved', reviewed_by=?, reviewed_at=NOW(), updated_at=NOW()
        WHERE plan_id=$1 AND school_id=$2 AND is_deleted=false`,
      [userId, req.params.id, schoolId]
    );
    logActivity(req, { action: "lesson_plan.approve", entity: "lesson_plan", entityId: Number(req.params.id) });
    res.json({ approved: true });
  } catch (err) { next(err); }
});

// ── POST /api/lesson-plans/:id/reject ────────────────────────────────────────
router.post("/:id/reject", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { feedback } = req.body;
    if (!feedback?.trim()) return res.status(400).json({ message: "Feedback is required when rejecting" });

    await pool.query(
      `UPDATE lesson_plans
          SET status='rejected', admin_feedback=?, reviewed_by=?, reviewed_at=NOW(), updated_at=NOW()
        WHERE plan_id=$1 AND school_id=$2 AND is_deleted=false`,
      [feedback, userId, req.params.id, schoolId]
    );
    logActivity(req, { action: "lesson_plan.reject", entity: "lesson_plan", entityId: Number(req.params.id), description: feedback.slice(0, 80) });
    res.json({ rejected: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/lesson-plans/:id — soft delete (teacher/admin own drafts) ─────
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;
    const [[plan]] = await pool.query(
      `SELECT * FROM lesson_plans WHERE plan_id=$1 AND school_id=$2 AND is_deleted=false`,
      [req.params.id, schoolId]
    );
    if (!plan) return res.status(404).json({ message: "Not found" });
    if (role === "teacher" && plan.teacher_id !== userId)
      return res.status(403).json({ message: "Access denied" });
    if (plan.status === "approved" && role !== "admin")
      return res.status(400).json({ message: "Cannot delete approved plans" });

    await pool.query(
      `UPDATE lesson_plans SET is_deleted=1, updated_at=NOW() WHERE plan_id=?`,
      [req.params.id]
    );
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
