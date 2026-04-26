/**
 * KNEC CBC Grading Utility
 * Assigns official KNEC performance levels:
 *   EE = Exceeds Expectation  (75-100%)
 *   ME = Meets Expectation    (50-74%)
 *   AE = Approaches Expectation (30-49%)
 *   BE = Below Expectation    (0-29%)
 *
 * Sub-levels (1 = higher, 2 = lower within band):
 *   EE1: 90-100  EE2: 75-89
 *   ME1: 60-74   ME2: 50-59
 *   AE1: 40-49   AE2: 30-39
 *   BE1: 20-29   BE2:  0-19
 */

export function knecGrade(percentage) {
  const p = Number(percentage) || 0;
  if (p >= 90) return { grade: 'EE1', level: 'EE', label: 'Exceeds Expectation' };
  if (p >= 75) return { grade: 'EE2', level: 'EE', label: 'Exceeds Expectation' };
  if (p >= 60) return { grade: 'ME1', level: 'ME', label: 'Meets Expectation' };
  if (p >= 50) return { grade: 'ME2', level: 'ME', label: 'Meets Expectation' };
  if (p >= 40) return { grade: 'AE1', level: 'AE', label: 'Approaches Expectation' };
  if (p >= 30) return { grade: 'AE2', level: 'AE', label: 'Approaches Expectation' };
  if (p >= 20) return { grade: 'BE1', level: 'BE', label: 'Below Expectation' };
  return         { grade: 'BE2', level: 'BE', label: 'Below Expectation' };
}

/**
 * Rank students within a class by mean score.
 *
 * @param {Array} students - each: { student_id, name, subjects: [{ subject, marks, total_marks }] }
 * @returns Array sorted position 1..N with KNEC grades per subject and overall
 */
export function classRanking(students = []) {
  const scored = students.map(s => {
    const subjectScores = (s.subjects || []).map(r => {
      const pct = r.total_marks > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;
      return {
        subject:     r.subject,
        marks:       r.marks,
        total_marks: r.total_marks,
        percentage:  +pct.toFixed(1),
        ...knecGrade(pct),
      };
    });

    const mean = subjectScores.length
      ? subjectScores.reduce((a, b) => a + b.percentage, 0) / subjectScores.length
      : 0;

    return {
      student_id:    s.student_id,
      name:          s.name,
      admission_number: s.admission_number || '',
      class_name:    s.class_name || '',
      subjectScores,
      mean:          +mean.toFixed(1),
      subjectsTaken: subjectScores.length,
      ...knecGrade(mean),
    };
  });

  // Sort descending by mean
  scored.sort((a, b) => b.mean - a.mean);

  // Assign position (tie-aware: same mean = same position)
  let pos = 1;
  return scored.map((s, i) => {
    if (i > 0 && s.mean < scored[i - 1].mean) pos = i + 1;
    return { ...s, position: pos };
  });
}

/**
 * Build a per-subject mean for a class — used for performance sheet columns.
 */
export function subjectMeans(studentRankings = []) {
  const bySubject = {};
  for (const student of studentRankings) {
    for (const sc of student.subjectScores || []) {
      if (!bySubject[sc.subject]) bySubject[sc.subject] = { sum: 0, count: 0 };
      bySubject[sc.subject].sum   += sc.percentage;
      bySubject[sc.subject].count += 1;
    }
  }
  return Object.entries(bySubject).map(([subject, { sum, count }]) => ({
    subject,
    mean: count ? +(sum / count).toFixed(1) : 0,
    ...knecGrade(count ? sum / count : 0),
  }));
}
