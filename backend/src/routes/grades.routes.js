import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// ─── Helper: map DB result row → camelCase shape the frontend expects ─────────
function normalise(r) {
  return {
    id:             r.result_id,
    studentId:      r.student_id,
    studentName:    r.student_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    className:      r.class_name  ?? "",
    subject:        r.subject_name ?? r.subject ?? "",
    term:           r.term        ?? "Term 2",
    marks:          Number(r.marks ?? 0),
    total:          Number(r.total_marks ?? 100),
    grade:          r.grade       ?? "",
    teacherComment: r.teacher_comment ?? "",
  };
}

// ─── GET /api/grades — list all results for the school ───────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term, classId } = req.query;

    let sql = `
        SELECT r.result_id, r.student_id, r.marks, r.total_marks, r.grade,
            r.teacher_comment, r.term,
            r.subject,
            s.first_name, s.last_name,
            s.class_name
    FROM results r
    JOIN students s  ON s.student_id  = r.student_id
    LEFT JOIN classes c ON c.class_id = r.class_id
    WHERE r.school_id = ? AND r.is_deleted = 0`;
    const params = [schoolId];

    if (studentId) { sql += " AND r.student_id = ?"; params.push(studentId); }
    if (term)      { sql += " AND r.term = ?";       params.push(term); }
    if (classId)   { sql += " AND r.class_id = ?";   params.push(classId); }

    sql += " ORDER BY r.result_id DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalise));
} catch (err) { next(err); }
});

// ─── GET /api/grades/:id — single result ─────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
    `SELECT r.result_id, r.student_id, r.marks, r.total_marks, r.grade,
            r.teacher_comment, r.term,
            r.subject,
            s.first_name, s.last_name,
            s.class_name
        FROM results r
        JOIN students s   ON s.student_id  = r.student_id
        LEFT JOIN classes c ON c.class_id = r.class_id
        WHERE r.result_id = ? AND r.school_id = ? AND r.is_deleted = 0 LIMIT 1`,
        [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Result not found" });
    res.json(normalise(rows[0]));
  } catch (err) { next(err); }
});

// ─── POST /api/grades/bulk — save multiple subjects for one student ───────────
router.post("/bulk", requireRoles("admin", "teacher"), async (req, res, next) => {
try {
    const { schoolId } = req.user;
    const { studentId, classId, term = "Term 2", totalMarks = 100, subjects = [], examId } = req.body;

    if (!studentId || !subjects.length)
    return res.status(400).json({ message: "studentId and subjects[] are required" });

    // Verify student belongs to this school
    const [stuRows] = await pool.query(
    `SELECT student_id, class_id FROM students WHERE student_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
    [studentId, schoolId]
    );
    if (!stuRows.length) return res.status(404).json({ message: "Student not found" });

    const resolvedClassId = classId || stuRows[0].class_id;

    // Resolve or create a default exam for the term if not provided
    let resolvedExamId = examId;
    if (!resolvedExamId) {
    const [exRows] = await pool.query(
        `SELECT exam_id FROM exams WHERE school_id = ? AND term = ? AND is_deleted = 0 LIMIT 1`,
        [schoolId, term]
    );
        if (exRows.length) {
        resolvedExamId = exRows[0].exam_id;
    } else {
        const [ins] = await pool.query(
            `INSERT INTO exams (school_id, exam_name, term, academic_year, status) VALUES (?, ?, ?, YEAR(CURDATE()), 'published')`,
            [schoolId, `${term} Exam`, term]
        );
        resolvedExamId = ins.insertId;
    }
    }

    const calcGrade = (marks, total) => {
      const pct = (Number(marks) / Number(total || 1)) * 100;
    if (pct >= 80) return "EE";
    if (pct >= 65) return "ME";
    if (pct >= 50) return "AE";
    return "BE";
    };

    const saved = [];
    for (const entry of subjects) {
        const { subject, marks } = entry;
        if (!subject || marks === undefined || marks === null || marks === "") continue;

      // Resolve subject_id — find or create the subject
        let [subRows] = await pool.query(
        `SELECT subject_id FROM subjects WHERE school_id = ? AND subject_name = ? AND is_deleted = 0 LIMIT 1`,
        [schoolId, subject]
    );
        let subjectId;
        if (subRows.length) {
        subjectId = subRows[0].subject_id;
    } else {
        const code = subject.substring(0, 10).toUpperCase().replace(/\s+/g, "_");
        const [ins] = await pool.query(
            `INSERT INTO subjects (school_id, subject_name, code) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE subject_id=LAST_INSERT_ID(subject_id)`,
            [schoolId, subject, code]
        );
        subjectId = ins.insertId;
    }

    const grade = calcGrade(marks, totalMarks);

      // Upsert — update if already exists for this student/subject combo
    const [res] = await pool.query(
        `INSERT INTO results (school_id, student_id, subject, class_id, marks, total_marks, grade, term)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE marks=VALUES(marks), total_marks=VALUES(total_marks), grade=VALUES(grade), is_deleted=0, updated_at=CURRENT_TIMESTAMP`,
        [schoolId, studentId, subject, resolvedClassId, Number(marks), Number(totalMarks), grade, term]
    );
        saved.push({ subjectId, resultId: res.insertId || res.info });
    }

    res.status(201).json({ saved: saved.length, message: `${saved.length} result(s) saved` });
} catch (err) { next(err); }
});

// ─── PUT /api/grades/:id — update a single result ────────────────────────────
router.put("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
try {
    const { schoolId } = req.user;
    const { marks, totalMarks, subject, term, teacherComment } = req.body;

    const m = Number(marks);
    const t = Number(totalMarks || 100);
    const pct = (m / (t || 1)) * 100;
    const grade = pct >= 80 ? "EE" : pct >= 65 ? "ME" : pct >= 50 ? "AE" : "BE";

    // If subject name provided, resolve subject_id
    let subjectClause = "";
    const params = [m, t, grade, term, teacherComment || null];
    if (subject) {
    const [subRows] = await pool.query(
        `SELECT subject_id FROM subjects WHERE school_id = ? AND subject_name = ? AND is_deleted = 0 LIMIT 1`,
        [schoolId, subject]
    );
        if (subRows.length) { subjectClause = ", subject_id=?"; params.push(subRows[0].subject_id); }
    }

    params.push(req.params.id, schoolId);

    const [result] = await pool.query(
        `UPDATE results SET marks=?, total_marks=?, grade=?, term=?, teacher_comment=?${subjectClause}, updated_at=CURRENT_TIMESTAMP
        WHERE result_id=? AND school_id=? AND is_deleted=0`,
        params
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Result not found" });
    res.json({ updated: true });
} catch (err) { next(err); }
});

// ─── DELETE /api/grades/:id — soft delete ────────────────────────────────────
router.delete("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
    `UPDATE results SET is_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE result_id=? AND school_id=?`,
    [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Result not found" });
    res.json({ deleted: true });
} catch (err) { next(err); }
});

export default router;
