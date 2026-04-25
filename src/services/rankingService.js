/**
 * Academic Ranking Service
 * 
 * Implements class-wide ranking engine with:
 * - Sum of marks per student
 * - Mean (average) per student  
 * - Subject-wise ranking
 * - Proper tie handling (same rank for equal scores)
 */

import { apiFetch } from '../lib/api';
import { calculateGrade, getGradePoints } from '../lib/grading';

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
    minSubjects = 1,    // Minimum subjects to be ranked
    includeGradeInfo = true 
  } = options;

  if (!results || results.length === 0) {
    return { students: [], subjects: [], summary: {} };
  }

  // Group by student
  const byStudent = results.reduce((acc, result) => {
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

    // Only include valid marks (not absent, cheating, etc.)
    const marks = parseFloat(result.marks);
    const total = parseFloat(result.total_marks || result.totalMarks || 100);
    
    if (!isNaN(marks) && marks >= 0) {
      const percentage = (marks / total) * 100;
      
      acc[studentId].subjects.push({
        subject: result.subject,
        marks: marks,
        total: total,
        percentage: Math.round(percentage * 100) / 100,
        grade: includeGradeInfo ? calculateGrade(percentage).grade : null
      });
    }

    return acc;
  }, {});

  // Calculate totals and means per student
  const students = Object.values(byStudent)
    .filter(s => s.subjects.length >= minSubjects)
    .map(s => {
      const validSubjects = s.subjects;
      const totalMarks = validSubjects.reduce((sum, subj) => sum + subj.percentage, 0);
      const meanScore = totalMarks / validSubjects.length;
      
      // Calculate KNEC points if applicable
      const totalPoints = validSubjects.reduce((sum, subj) => 
        sum + getGradePoints(subj.percentage), 0);
      const meanPoints = totalPoints / validSubjects.length;

      return {
        ...s,
        total_subjects: validSubjects.length,
        total_marks: Math.round(totalMarks * 100) / 100,
        mean_score: Math.round(meanScore * 100) / 100,
        total_points: Math.round(totalPoints * 100) / 100,
        mean_points: Math.round(meanPoints * 100) / 100,
        overall_grade: calculateGrade(meanScore).grade
      };
    });

  // Sort by mean score descending, then by total marks
  students.sort((a, b) => {
    if (b.mean_score !== a.mean_score) {
      return b.mean_score - a.mean_score;
    }
    return b.total_marks - a.total_marks;
  });

  // Assign ranks (handle ties)
  let currentRank = 1;
  let previousScore = null;
  
  const rankedStudents = students.map((student, index) => {
    if (previousScore !== null && student.mean_score < previousScore) {
      currentRank = index + 1;
    }
    previousScore = student.mean_score;
    
    return {
      ...student,
      rank: currentRank,
      out_of: students.length
    };
  });

  // Calculate subject-wise rankings
  const subjectList = [...new Set(results.map(r => r.subject))];
  const subjectRankings = subjectList.map(subject => {
    const subjectResults = results.filter(r => r.subject === subject);
    const scores = subjectResults.map(r => {
      const marks = parseFloat(r.marks);
      const total = parseFloat(r.total_marks || r.totalMarks || 100);
      return {
        student_id: r.student_id || r.studentId,
        marks,
        percentage: (marks / total) * 100
      };
    }).filter(s => !isNaN(s.percentage));

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
  const allMeans = rankedStudents.map(s => s.mean_score);
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

  return {
    students: rankedStudents,
    subjects: subjectRankings,
    summary
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
      const marks = parseFloat(r.marks);
      const total = parseFloat(r.total_marks || r.totalMarks || 100);
      return (marks / total) * 100;
    })
    .filter(p => !isNaN(p));

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
    mean_score: student.mean_score,
    total_points: student.total_points,
    overall_grade: student.overall_grade,
    percentile: Math.round(((student.out_of - student.rank) / student.out_of) * 100)
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

export default {
  calculateClassRankings,
  calculateSubjectMean,
  getStudentPosition,
  formatRank,
  calculateTrend
};
