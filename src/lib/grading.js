/**
 * Shared Grading Utility
 * Centralizes grading logic to prevent inconsistencies across the app
 * Supports CBC (Kenya) and KNEC grading scales
 */

// CBC Grading Scale (Competency Based Curriculum)
export const CBC_GRADES = [
  { grade: 'EE', min: 80, max: 100, label: 'Exceeds Expectations', color: '#22c55e' },
  { grade: 'ME', min: 65, max: 79, label: 'Meets Expectations', color: '#3b82f6' },
  { grade: 'AE', min: 50, max: 64, label: 'Approaches Expectations', color: '#f59e0b' },
  { grade: 'BE', min: 0, max: 49, label: 'Below Expectations', color: '#ef4444' },
];

// KNEC Grading Scale (8-4-4 system)
export const KNEC_GRADES = [
  { grade: 'A', min: 80, max: 100, label: 'Excellent', color: '#22c55e' },
  { grade: 'A-', min: 75, max: 79, label: 'Very Good', color: '#4ade80' },
  { grade: 'B+', min: 70, max: 74, label: 'Good', color: '#60a5fa' },
  { grade: 'B', min: 65, max: 69, label: 'Good', color: '#3b82f6' },
  { grade: 'B-', min: 60, max: 64, label: 'Fair', color: '#93c5fd' },
  { grade: 'C+', min: 55, max: 59, label: 'Fair', color: '#fbbf24' },
  { grade: 'C', min: 50, max: 54, label: 'Average', color: '#f59e0b' },
  { grade: 'C-', min: 45, max: 49, label: 'Below Average', color: '#fb923c' },
  { grade: 'D+', min: 40, max: 44, label: 'Below Average', color: '#f87171' },
  { grade: 'D', min: 35, max: 39, label: 'Poor', color: '#ef4444' },
  { grade: 'D-', min: 30, max: 34, label: 'Very Poor', color: '#dc2626' },
  { grade: 'E', min: 0, max: 29, label: 'Fail', color: '#991b1b' },
];

// Special marks handling
export const SPECIAL_MARKS = {
  ABSENT: -1,
  INCOMPLETE: -2,
  CHEATING: -3,
  MEDICAL: -4,
};

/**
 * Calculate grade based on percentage score
 * @param {number} percentage - Score percentage (0-100)
 * @param {string} curriculum - 'cbc' or 'knec'
 * @returns {Object} Grade info { grade, label, color }
 */
export function calculateGrade(percentage, curriculum = 'cbc') {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return { grade: '-', label: 'No Score', color: '#9ca3af' };
  }

  const grades = curriculum === 'knec' ? KNEC_GRADES : CBC_GRADES;
  const gradeInfo = grades.find(g => percentage >= g.min && percentage <= g.max);
  
  return gradeInfo || { grade: 'E', label: 'Fail', color: '#ef4444' };
}

/**
 * Calculate grade from marks and total
 * @param {number} marks - Student marks
 * @param {number} total - Maximum marks
 * @param {string} curriculum - 'cbc' or 'knec'
 * @returns {Object} Grade info
 */
export function calculateGradeFromMarks(marks, total, curriculum = 'cbc') {
  if (marks === null || marks === undefined || total === 0 || total === null) {
    return { grade: '-', label: 'No Score', color: '#9ca3af' };
  }
  
  // Handle special marks
  if (marks < 0) {
    const specialLabel = {
      [SPECIAL_MARKS.ABSENT]: 'Absent',
      [SPECIAL_MARKS.INCOMPLETE]: 'Incomplete',
      [SPECIAL_MARKS.CHEATING]: 'Cheating',
      [SPECIAL_MARKS.MEDICAL]: 'Medical',
    }[marks] || 'Unknown';
    
    return { grade: 'X', label: specialLabel, color: '#9ca3af', isSpecial: true };
  }
  
  const percentage = (marks / total) * 100;
  return calculateGrade(percentage, curriculum);
}

/**
 * Get color for a grade
 * @param {string} grade - Grade letter
 * @returns {string} Hex color
 */
export function getGradeColor(grade) {
  const allGrades = [...CBC_GRADES, ...KNEC_GRADES];
  const found = allGrades.find(g => g.grade === grade);
  return found?.color || '#9ca3af';
}

/**
 * Calculate mean score from array of results
 * @param {Array} results - Array of { marks, total_marks }
 * @returns {Object} { mean, total, count, percentage }
 */
export function calculateMeanScore(results) {
  if (!results || results.length === 0) {
    return { mean: 0, total: 0, count: 0, percentage: 0 };
  }

  let totalMarks = 0;
  let totalPossible = 0;
  let validCount = 0;

  for (const r of results) {
    const marks = Number(r.marks);
    const possible = Number(r.total_marks);
    
    // Skip special marks and invalid entries
    if (marks < 0 || isNaN(marks) || isNaN(possible) || possible === 0) {
      continue;
    }
    
    totalMarks += marks;
    totalPossible += possible;
    validCount++;
  }

  if (validCount === 0 || totalPossible === 0) {
    return { mean: 0, total: 0, count: 0, percentage: 0 };
  }

  const percentage = (totalMarks / totalPossible) * 100;

  return {
    mean: parseFloat((totalMarks / validCount).toFixed(2)),
    total: totalMarks,
    count: validCount,
    percentage: parseFloat(percentage.toFixed(2)),
  };
}

/**
 * Calculate class mean from student results
 * @param {Array} studentResults - Array of student result objects
 * @returns {number} Class mean percentage
 */
export function calculateClassMean(studentResults) {
  if (!studentResults || studentResults.length === 0) return 0;
  
  let totalPercentage = 0;
  let validStudents = 0;

  for (const student of studentResults) {
    const results = student.results || student.subjects || [];
    if (results.length === 0) continue;
    
    const meanData = calculateMeanScore(results);
    if (meanData.count > 0) {
      totalPercentage += meanData.percentage;
      validStudents++;
    }
  }

  return validStudents > 0 ? parseFloat((totalPercentage / validStudents).toFixed(2)) : 0;
}

/**
 * Determine if student passed based on grading system
 * @param {number} percentage - Score percentage
 * @param {string} curriculum - 'cbc' or 'knec'
 * @returns {boolean}
 */
export function isPassing(percentage, curriculum = 'cbc') {
  const grade = calculateGrade(percentage, curriculum);
  
  if (curriculum === 'cbc') {
    return percentage >= 50; // AE and above passes
  }
  
  // KNEC: E is fail, D- and above passes
  return percentage >= 30;
}

/**
 * Calculate pass rate for a class
 * @param {Array} results - Array of student mean scores
 * @param {string} curriculum - 'cbc' or 'knec'
 * @returns {Object} { passed, failed, passRate }
 */
export function calculatePassRate(results, curriculum = 'cbc') {
  if (!results || results.length === 0) {
    return { passed: 0, failed: 0, passRate: 0 };
  }

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const percentage = r.percentage || r.mean_score || 0;
    if (isPassing(percentage, curriculum)) {
      passed++;
    } else {
      failed++;
    }
  }

  const total = passed + failed;
  return {
    passed,
    failed,
    passRate: total > 0 ? parseFloat(((passed / total) * 100).toFixed(1)) : 0,
  };
}

/**
 * Get position label based on rank
 * @param {number} rank - Student rank
 * @param {number} total - Total students
 * @returns {string} Position text
 */
export function getPositionLabel(rank, total) {
  if (rank === 1) return '🥇 1st';
  if (rank === 2) return '🥈 2nd';
  if (rank === 3) return '🥉 3rd';
  return `${rank}${getOrdinalSuffix(rank)}`;
}

function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Get grade points for GPA calculation (KNEC scale)
 * @param {string} grade - Grade letter
 * @returns {number} Grade points (A=12, A-=11, B+=10, B=9, B-=8, C+=7, C=6, C-=5, D+=4, D=3, D-=2, E=1)
 */
export function getGradePoints(grade) {
  const points = {
    'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8,
    'C+': 7, 'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2, 'E': 1,
    'EE': 4, 'ME': 3, 'AE': 2, 'BE': 1
  };
  return points[grade] || 0;
}

/**
 * Parse a mark value to handle special marks (ABSENT, CHEATING, etc.)
 * @param {string|number} marks - The mark value
 * @returns {Object} Parsed result { value, isSpecial, specialType, display }
 */
export function parseMark(marks) {
  if (marks === null || marks === undefined || marks === '') {
    return { value: null, isSpecial: true, specialType: 'NOT_ASSESSED', display: 'N/A' };
  }
  
  const strMark = String(marks).trim().toUpperCase();
  
  // Check for special marks
  if (strMark === 'X' || strMark === 'ABSENT') {
    return { value: SPECIAL_MARKS.ABSENT, isSpecial: true, specialType: 'ABSENT', display: 'X' };
  }
  if (strMark === 'Y' || strMark === 'CHEAT' || strMark === 'CHEATING') {
    return { value: SPECIAL_MARKS.CHEATING, isSpecial: true, specialType: 'CHEATING', display: 'Y' };
  }
  if (strMark === 'N/A' || strMark === 'NA' || strMark === '-') {
    return { value: null, isSpecial: true, specialType: 'NOT_ASSESSED', display: 'N/A' };
  }
  if (strMark === 'INC' || strMark === 'INCOMPLETE') {
    return { value: SPECIAL_MARKS.INCOMPLETE, isSpecial: true, specialType: 'INCOMPLETE', display: 'INC' };
  }
  
  // Regular numeric mark
  const numValue = parseFloat(marks);
  if (isNaN(numValue)) {
    return { value: null, isSpecial: true, specialType: 'UNKNOWN', display: '?' };
  }
  
  return { value: numValue, isSpecial: false, specialType: null, display: String(numValue) };
}

/**
 * Format a score for display
 * @param {number} score - The score value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted score
 */
export function formatScore(score, decimals = 2) {
  if (score === null || score === undefined || isNaN(score)) {
    return '-';
  }
  return Number(score).toFixed(decimals);
}

export default {
  calculateGrade,
  calculateGradeFromMarks,
  calculateMeanScore,
  calculateClassMean,
  calculatePassRate,
  getGradeColor,
  getGradePoints,
  isPassing,
  getPositionLabel,
  parseMark,
  formatScore,
  CBC_GRADES,
  KNEC_GRADES,
  SPECIAL_MARKS,
};
