/**
 * CBC performance levels (aligned with src/lib/grading.js CBC_SUB_LEVELS)
 * Parent: EE 80–100 | ME 65–79 | AE 50–64 | BE 0–49
 * Sub: EE1 90–100, EE2 80–89, ME1 70–79, ME2 65–69,
 *      AE1 55–64, AE2 50–54, BE1 40–49, BE2 0–39
 */
export function knecGrade(percentage) {
  const p = Number(percentage);
  const pct = Number.isFinite(p) ? p : 0;
  if (pct >= 90) return { grade: "EE1", level: "EE", label: "Exceeds Expectations (1)" };
  if (pct >= 80) return { grade: "EE2", level: "EE", label: "Exceeds Expectations (2)" };
  if (pct >= 70) return { grade: "ME1", level: "ME", label: "Meets Expectations (1)" };
  if (pct >= 65) return { grade: "ME2", level: "ME", label: "Meets Expectations (2)" };
  if (pct >= 55) return { grade: "AE1", level: "AE", label: "Approaches Expectations (1)" };
  if (pct >= 50) return { grade: "AE2", level: "AE", label: "Approaches Expectations (2)" };
  if (pct >= 40) return { grade: "BE1", level: "BE", label: "Below Expectations (1)" };
  return { grade: "BE2", level: "BE", label: "Below Expectations (2)" };
}

export function classRanking(students = [], totalSubjects = null) {
  const scored = students.map((s) => {
    const subjectScores = (s.subjects || []).map((r) => {
      const pct = r.total_marks > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;
      return {
        subject: r.subject,
        marks: r.marks,
        total_marks: r.total_marks,
        percentage: +pct.toFixed(1),
        ...knecGrade(pct),
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
      overall: knecGrade(mean),
    };
  });
  scored.sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name));
  let rank = 1;
  let prev = null;
  return scored.map((s, idx) => {
    if (prev !== null && s.mean < prev - 0.001) rank = idx + 1;
    prev = s.mean;
    return { ...s, position: rank };
  });
}

export default { knecGrade, classRanking };
