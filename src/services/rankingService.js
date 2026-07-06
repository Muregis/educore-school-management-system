/**
 * Academic Ranking Service
 * 
 * Implements class-wide ranking engine with:
 * - Sum of marks per student
 * - Mean (average) per student  
 * - Subject-wise ranking
 * - Proper tie handling (same rank for equal scores)
 */

import { calculateGrade, getGradePoints, parseMark } from '../lib/grading.js';

/**
 * Calculate class rankings from grade results
 * 
 * @param {Array} results - Array of grade objects { student_id, subject, marks, total_marks }
 * @param {Object} options - Calculation options
 * @returns {Object} Rankings with students sorted by total marks
 */
export function calculateClassRankings(results, options = {}) {
  const { 
    subjects = null,  // Filter to specific subjects
    minSubjects = 9,    // Minimum subjects to be ranked (increased from 1 to avoid students with few/no exams leading)
    includeGradeInfo = true,
    className = null    // Optional: filter by specific class
  } = options;

  if (!results || results.length === 0) {
    return { students: [], subjects: [], summary: {} };
  }

  // Filter by class if specified
  let filteredResults = results;
  if (className) {
    filteredResults = results.filter(r => {
      const resultClass = (r.class_name || r.className || '').toLowerCase().trim();
      const targetClass = className.toLowerCase().trim();
      return resultClass === targetClass;
    });
  }

  if (filteredResults.length === 0) {
    return { students: [], subjects: [], summary: {} };
  }

  // Group by student
  const byStudent = filteredResults.reduce((acc, result) => {
    const studentId = result.student_id || result.studentId;
    if (!acc[studentId]) {
      acc[studentId] = {
        student_id: studentId,
        student_name: result.student_name || result.studentName || `Student ${studentId}`,
        admission_number: result.admission_number || result.admissionNumber || '',
        class_name: result.class_name || result.className || '',
        subjects: []
      };
    }

    const total = parseFloat(result.total_marks || result.totalMarks || 100) || 100;
    const parsed = parseMark(result.marks);

    // Only include valid marks (not special marks like absent, cheat, etc.)
    if (!parsed.isSpecial && parsed.value != null && parsed.value >= 0 && total > 0) {
      const percentage = (parsed.value / total) * 100;

      acc[studentId].subjects.push({
        subject: result.subject,
        marks: parsed.value,
        total,
        percentage: Math.round(percentage * 100) / 100,
        grade: includeGradeInfo ? calculateGrade(percentage).grade : null,
      });
    }

    return acc;
  }, {});

  // Calculate totals and means per student
  const students = Object.values(byStudent)
    .filter(s => s.subjects.length >= minSubjects)
    .map(s => {
      const validSubjects = s.subjects;

      // Raw totals (marks and possible) and per-entry percentages
      const totalMarksRaw = validSubjects.reduce((sum, subj) => sum + (Number(subj.marks) || 0), 0);
      const maxPossible = validSubjects.reduce((sum, subj) => sum + (Number(subj.total) || 0), 0);
      const sumPercentages = validSubjects.reduce((sum, subj) => sum + subj.percentage, 0);
      const meanScore = sumPercentages / validSubjects.length;

      // Calculate grade points using derived grade for each subject
      const totalPoints = validSubjects.reduce((sum, subj) => {
        const grade = calculateGrade(subj.percentage).grade;
        return sum + getGradePoints(grade);
      }, 0);
      const meanPoints = totalPoints / validSubjects.length;

      return {
        ...s,
        totalSubjects: validSubjects.length,
        totalMarksRaw: Math.round(totalMarksRaw * 100) / 100,
        maxPossible: Math.round(maxPossible * 100) / 100,
        totalMarks: Math.round(totalMarksRaw * 100) / 100, // raw marks sum for UI display
        totalPercent: Math.round(sumPercentages * 100) / 100, // sum of percentages (auxiliary)
        meanScore: Math.round(meanScore * 100) / 100,
        totalPoints: Math.round(totalPoints * 100) / 100,
        meanPoints: Math.round(meanPoints * 100) / 100,
        overallGrade: calculateGrade(meanScore).grade,
        studentName: s.student_name || s.studentName || `Student ${s.student_id}`,
        admissionNumber: s.admission_number || s.admissionNumber || ''
      };
    });

  // Sort by mean score descending, then by total raw marks
  students.sort((a, b) => {
    if (b.meanScore !== a.meanScore) return b.meanScore - a.meanScore;
    return b.totalMarks - a.totalMarks;
  });

  // Assign ranks (students with the same mean share the same rank)
  let currentRank = 1;
  let previousMean = null;

  const rankedStudents = students.map((student, index) => {
    if (previousMean !== null && student.meanScore < previousMean - 0.0001) {
      currentRank = index + 1;
    }
    previousMean = student.meanScore;

    return {
      ...student,
      rank: currentRank,
      out_of: students.length,
    };
  });

  // Calculate subject-wise rankings
  const subjectList = [...new Set(results.map(r => r.subject))];
  const subjectRankings = subjectList.map(subject => {
    const subjectResults = results.filter(r => r.subject === subject);
    const scores = subjectResults.map(r => {
      const total = parseFloat(r.total_marks || r.totalMarks || 100) || 100;
      const parsed = parseMark(r.marks);
      if (parsed.isSpecial || parsed.value == null || parsed.value < 0) return null;
      return {
        student_id: r.student_id || r.studentId,
        marks: parsed.value,
        percentage: (parsed.value / total) * 100,
      };
    }).filter(Boolean);

    if (scores.length === 0) return null;

    const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
    const sum = sorted.reduce((acc, s) => acc + s.percentage, 0);

    return {
      subject,
      entries: scores.length,
      avg_score: Math.round((sum / scores.length) * 100) / 100,
      highest: Math.round(sorted[0].percentage * 100) / 100,
      lowest: Math.round(sorted[sorted.length - 1].percentage * 100) / 100,
      top_student: sorted[0].student_id
    };
  }).filter(Boolean);

  // Calculate class summary statistics
  const allMeans = rankedStudents.map(s => s.meanScore);
  const summary = {
    total_students: rankedStudents.length,
    class_mean: allMeans.length > 0 
      ? Math.round((allMeans.reduce((a, b) => a + b, 0) / allMeans.length) * 100) / 100
      : 0,
    highest_mean: allMeans.length > 0 ? Math.max(...allMeans) : 0,
    lowest_mean: allMeans.length > 0 ? Math.min(...allMeans) : 0,
    passing_count: allMeans.filter(m => m >= 50).length,
    failing_count: allMeans.filter(m => m < 50).length,
    pass_rate: allMeans.length > 0 
      ? Math.round((allMeans.filter(m => m >= 50).length / allMeans.length) * 100)
      : 0
  };

  const classStats = {
    meanScore: summary.class_mean,
    highestMean: summary.highest_mean,
    lowestMean: summary.lowest_mean,
    passingCount: summary.passing_count,
    failingCount: summary.failing_count,
    passRate: summary.pass_rate,
    totalStudents: summary.total_students
  };

  return {
    students: rankedStudents,
    subjects: subjectRankings,
    summary,
    classStats
  };
}

/**
 * Calculate subject-wise mean for a class
 * 
 * @param {Array} results - Grade results
 * @param {string} subject - Subject name
 * @returns {Object} Subject statistics
 */
export function calculateSubjectMean(results, subject) {
  const subjectResults = results.filter(r => r.subject === subject);
  
  const validScores = subjectResults
    .map(r => {
      const total = parseFloat(r.total_marks || r.totalMarks || 100) || 100;
      const parsed = parseMark(r.marks);
      if (parsed.isSpecial || parsed.value == null || parsed.value < 0) return null;
      return (parsed.value / total) * 100;
    })
    .filter(p => p != null && !Number.isNaN(p));

  if (validScores.length === 0) {
    return { subject, mean: 0, entries: 0, valid: false };
  }

  const sum = validScores.reduce((a, b) => a + b, 0);
  const mean = sum / validScores.length;

  return {
    subject,
    mean: Math.round(mean * 100) / 100,
    entries: validScores.length,
    valid: true,
    highest: Math.max(...validScores),
    lowest: Math.min(...validScores)
  };
}

/**
 * Get student position in class
 * 
 * @param {Array} rankedStudents - Output from calculateClassRankings
 * @param {string} studentId - Student to find
 * @returns {Object|null} Position info
 */
export function getStudentPosition(rankedStudents, studentId) {
  const student = rankedStudents.find(s => 
    String(s.student_id) === String(studentId)
  );
  
  if (!student) return null;

  return {
    rank: student.rank,
    out_of: student.out_of,
    meanScore: student.meanScore,
    totalPoints: student.totalPoints,
    overallGrade: student.overallGrade,
    percentile: student.out_of > 0
      ? Math.round(((student.out_of - student.rank + 1) / student.out_of) * 100)
      : 0,
  };
}

/**
 * Format rank for display (1st, 2nd, 3rd, etc.)
 */
export function formatRank(rank) {
  const num = parseInt(rank);
  if (isNaN(num)) return rank;

  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = num % 100 >= 11 && num % 100 <= 13 
    ? 'th' 
    : suffixes[num % 10] || 'th';
  
  return `${num}${suffix}`;
}

/**
 * Get performance trend (improving, declining, stable)
 */
export function calculateTrend(currentMean, previousMean, threshold = 5) {
  const diff = currentMean - previousMean;
  
  if (Math.abs(diff) < threshold) return 'stable';
  if (diff > 0) return 'improving';
  return 'declining';
}

const rankingService = {
  calculateClassRankings,
  calculateSubjectMean,
  getStudentPosition,
  formatRank,
  calculateTrend
};

export { rankingService };
export default rankingService;
