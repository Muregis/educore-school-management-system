/**
 * Prefer loadSchoolGradingBands(schoolId) + makeGrader(bands) at call sites.
 * Sync knecGrade() only uses defaults when settings are not loaded.
 */
import {
  DEFAULT_CBC_BANDS,
  gradeFromBands,
  makeGrader,
  loadSchoolGradingBands,
} from "./gradingBands.js";

/** @deprecated Prefer makeGrader(await loadSchoolGradingBands(schoolId)) */
export function knecGrade(percentage) {
  const g = gradeFromBands(percentage, DEFAULT_CBC_BANDS);
  return { grade: g.grade, level: g.level || g.parent, label: g.label };
}

export function classRanking(students = [], totalSubjects = null, bands = DEFAULT_CBC_BANDS) {
  const gradeOf = makeGrader(bands);
  const scored = students.map((s) => {
    const subjectScores = (s.subjects || []).map((r) => {
      const pct = r.total_marks > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;
      const g = gradeOf(pct);
      return {
        subject: r.subject,
        marks: r.marks,
        total_marks: r.total_marks,
        percentage: +pct.toFixed(1),
        grade: g.grade,
        level: g.level,
        label: g.label,
      };
    });
    const subjectsCount = totalSubjects || subjectScores.length;
    const mean = subjectScores.length
      ? subjectScores.reduce((a, b) => a + b.percentage, 0) / subjectsCount
      : 0;
    return {
      student_id: s.student_id,
      name: s.name,
      admission_number: s.admission_number || "",
      class_name: s.class_name || "",
      subjectScores,
      mean: +mean.toFixed(1),
      subjectsTaken: subjectScores.length,
      overall: gradeOf(mean),
    };
  });
  scored.sort((a, b) => b.mean - a.mean || String(a.name).localeCompare(String(b.name)));
  let rank = 1;
  let prev = null;
  return scored.map((s, idx) => {
    if (prev !== null && s.mean < prev - 0.001) rank = idx + 1;
    prev = s.mean;
    return { ...s, position: rank };
  });
}

export { loadSchoolGradingBands, makeGrader, gradeFromBands, DEFAULT_CBC_BANDS };
export default { knecGrade, classRanking, loadSchoolGradingBands, makeGrader };
