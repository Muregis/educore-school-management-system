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


// CBC Sub-levels (Kenya primary/junior practice: EE1/EE2 … BE1/BE2)
export const CBC_SUB_LEVELS = [
  { grade: 'EE1', min: 90, max: 100, parent: 'EE', label: 'Exceeds Expectations (1)', color: '#16a34a' },
  { grade: 'EE2', min: 80, max: 89,  parent: 'EE', label: 'Exceeds Expectations (2)', color: '#22c55e' },
  { grade: 'ME1', min: 70, max: 79,  parent: 'ME', label: 'Meets Expectations (1)', color: '#2563eb' },
  { grade: 'ME2', min: 65, max: 69,  parent: 'ME', label: 'Meets Expectations (2)', color: '#3b82f6' },
  { grade: 'AE1', min: 55, max: 64,  parent: 'AE', label: 'Approaches Expectations (1)', color: '#d97706' },
  { grade: 'AE2', min: 50, max: 54,  parent: 'AE', label: 'Approaches Expectations (2)', color: '#f59e0b' },
  { grade: 'BE1', min: 40, max: 49,  parent: 'BE', label: 'Below Expectations (1)', color: '#ef4444' },
  { grade: 'BE2', min: 0,  max: 39,  parent: 'BE', label: 'Below Expectations (2)', color: '#b91c1c' },
];

export function calculateCbcSubLevel(percentage) {
  if (percentage === null || percentage === undefined || Number.isNaN(Number(percentage))) {
    return { grade: '-', parent: '-', label: 'No Score', color: '#9ca3af' };
  }
  const pct = Number(percentage);
  const found = CBC_SUB_LEVELS.find(g => pct >= g.min && pct <= g.max);
  return found
    ? { grade: found.grade, parent: found.parent, label: found.label, color: found.color, min: found.min, max: found.max }
    : { grade: 'BE2', parent: 'BE', label: 'Below Expectations (2)', color: '#b91c1c' };
}

export function cbcParentGrade(subOrParent) {
  const s = String(subOrParent || '').toUpperCase();
  if (['EE', 'ME', 'AE', 'BE'].includes(s)) return s;
  const found = CBC_SUB_LEVELS.find(g => g.grade === s);
  return found?.parent || '-';
}

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

// Cambridge / Pearson Edexcel IGCSE Grading Scale
export const IGCSE_GRADES = [
  { grade: 'A*', min: 90, max: 100, label: 'Distinction', color: '#16a34a' },
  { grade: 'A',  min: 80, max: 89,  label: 'Excellent', color: '#22c55e' },
  { grade: 'B',  min: 70, max: 79,  label: 'Good', color: '#3b82f6' },
  { grade: 'C',  min: 60, max: 69,  label: 'Pass / Credit', color: '#60a5fa' },
  { grade: 'D',  min: 50, max: 59,  label: 'Moderate', color: '#f59e0b' },
  { grade: 'E',  min: 40, max: 49,  label: 'Low Pass', color: '#fb923c' },
  { grade: 'F',  min: 30, max: 39,  label: 'Weak', color: '#f87171' },
  { grade: 'G',  min: 20, max: 29,  label: 'Poor', color: '#ef4444' },
  { grade: 'U',  min: 0,  max: 19,  label: 'Ungraded', color: '#991b1b' },
];

// College / Tertiary / TVET Grading Scale
export const COLLEGE_GRADES = [
  { grade: 'Distinction', min: 80, max: 100, label: 'Distinction / First Class', color: '#16a34a' },
  { grade: 'Credit',      min: 65, max: 79,  label: 'Credit / Upper Division', color: '#2563eb' },
  { grade: 'Pass',        min: 50, max: 64,  label: 'Pass / Lower Division', color: '#f59e0b' },
  { grade: 'Referral',    min: 40, max: 49,  label: 'Referral / Re-sit', color: '#f87171' },
  { grade: 'Fail',        min: 0,  max: 39,  label: 'Fail', color: '#ef4444' },
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

  const c = String(curriculum || 'cbc').toLowerCase();
  let grades;
  if (c === 'knec' || c === '844') {
    grades = KNEC_GRADES;
  } else if (c === 'igcse' || c === 'british' || c === 'cambridge' || c === 'international') {
    grades = IGCSE_GRADES;
  } else if (c === 'college' || c === 'tertiary' || c === 'tvet' || c === 'higher') {
    grades = COLLEGE_GRADES;
  } else {
    grades = CBC_GRADES;
  }

  const gradeInfo = grades.find(g => percentage >= g.min && percentage <= g.max);
  return gradeInfo || grades[grades.length - 1] || { grade: 'Fail', label: 'Fail', color: '#ef4444' };
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
  const allGrades = [
    ...CBC_GRADES,
    ...CBC_SUB_LEVELS,
    ...KNEC_GRADES,
    ...IGCSE_GRADES,
    ...COLLEGE_GRADES,
  ];
  const found = allGrades.find(g => String(g.grade).toUpperCase() === String(grade || '').toUpperCase());
  return found?.color || '#9ca3af';
}

/**
 * Calculate mean score from array of results
 * @param {Array} results - Array of { marks, total_marks }
 * @param {number} totalSubjects - Total number of subjects for this class (optional, defaults to subjects taken)
 * @returns {Object} { mean, total, count, percentage }
 */
export function calculateMeanScore(results, totalSubjects = null) {
  if (!results || results.length === 0) {
    return { mean: 0, total: 0, count: 0, percentage: 0 };
  }

  let totalMarks = 0;
  let totalPossible = 0;
  let validCount = 0;

  let sumPercentages = 0;

  for (const r of results) {
    const marks = Number(r.marks);
    const possible = Number(r.total_marks);

    // Skip special marks and invalid entries
    if (marks < 0 || isNaN(marks) || isNaN(possible) || possible === 0) {
      continue;
    }

    const entryPercent = (marks / possible) * 100;
    sumPercentages += entryPercent;
    totalMarks += marks;
    totalPossible += possible;
    validCount++;
  }

  if (validCount === 0 || totalPossible === 0) {
    return { mean: 0, total: 0, count: 0, percentage: 0 };
  }

  // Calculate mean based on total subjects if provided, otherwise use subjects taken
  const subjectsCount = totalSubjects || validCount;
  const mean = sumPercentages / subjectsCount; // average of per-entry percentages
  const percentage = (totalMarks / totalPossible) * 100; // weighted percentage across entries

  return {
    mean: parseFloat(mean.toFixed(2)),
    total: totalMarks,
    count: validCount,
    percentage: parseFloat(percentage.toFixed(2)),
    totalSubjects: subjectsCount,
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
  const c = String(curriculum || 'cbc').toLowerCase();
  if (c === 'knec' || c === '844') {
    return percentage >= 30; // D- and above passes
  }
  if (c === 'igcse' || c === 'british' || c === 'cambridge' || c === 'international') {
    return percentage >= 50; // Grade D / C and above passes
  }
  if (c === 'college' || c === 'tertiary' || c === 'tvet' || c === 'higher') {
    return percentage >= 50; // Pass mark is 50%
  }
  return percentage >= 50; // CBC AE and above passes
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
export function getPositionLabel(rank) {
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
export function getGradePoints(grade, curriculum = 'cbc') {
  const c = String(curriculum || '').toLowerCase();
  if (c === 'igcse' || c === 'british' || c === 'cambridge' || c === 'international') {
    const igcsePoints = {
      'A*': 8, 'A': 7, 'B': 6, 'C': 5, 'D': 4, 'E': 3, 'F': 2, 'G': 1, 'U': 0,
    };
    if (Object.prototype.hasOwnProperty.call(igcsePoints, grade)) return igcsePoints[grade];
  }
  const points = {
    // KNEC
    'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8,
    'C+': 7, 'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2, 'E': 1,
    // CBC
    'EE': 4, 'ME': 3, 'AE': 2, 'BE': 1,
    // IGCSE distinct grades
    'A*': 8, 'F': 2, 'G': 1, 'U': 0,
    // College / Tertiary GPA (4.0 scale)
    'Distinction': 4, 'Credit': 3, 'Pass': 2, 'Referral': 1, 'Fail': 0,
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
  calculateCbcSubLevel,
  cbcParentGrade,
  CBC_SUB_LEVELS,
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
  IGCSE_GRADES,
  COLLEGE_GRADES,
  SPECIAL_MARKS,
};
