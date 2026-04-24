/**
 * Grading System - Single Source of Truth
 * 
 * This module provides centralized grading calculation functions
 * to ensure consistency across the application.
 * 
 * Supports:
 * - CBC 4-Level Scale (EE, ME, AE, BE)
 * - KNEC 12-Point Scale (A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E)
 * 
 * Usage:
 *   import { calculateGrade, CBC_LEVELS, KNEC_SCALE } from '../lib/grading';
 *   const grade = calculateGrade(75, 'CBC');  // Returns ME level
 */

// CBC Competency Based Curriculum - 4 Level Scale
export const CBC_LEVELS = {
  EE: { 
    min: 80, 
    max: 100, 
    grade: 'EE', 
    label: 'Exceeds Expectations',
    description: 'Learner consistently exceeds expectations',
    color: '#22c55e',
    bgColor: '#052e16'
  },
  ME: { 
    min: 65,  // FIXED: Was 60 (incorrect)
    max: 79, 
    grade: 'ME', 
    label: 'Meets Expectations',
    description: 'Learner meets expectations',
    color: '#3b82f6',
    bgColor: '#0c1a2e'
  },
  AE: { 
    min: 50,  // FIXED: Was 40 (incorrect)
    max: 64, 
    grade: 'AE', 
    label: 'Approaching Expectations',
    description: 'Learner approaching expectations',
    color: '#f59e0b',
    bgColor: '#1c1400'
  },
  BE: { 
    min: 0, 
    max: 49, 
    grade: 'BE', 
    label: 'Below Expectations',
    description: 'Learner below expectations',
    color: '#ef4444',
    bgColor: '#1c0505'
  }
};

// KNEC 12-Point Grading Scale (Kenya National Examination Council)
export const KNEC_SCALE = [
  { min: 80, max: 100, grade: 'A', points: 12, label: 'Excellent' },
  { min: 75, max: 79, grade: 'A-', points: 11, label: 'Very Good' },
  { min: 70, max: 74, grade: 'B+', points: 10, label: 'Good' },
  { min: 65, max: 69, grade: 'B', points: 9, label: 'Above Average' },
  { min: 60, max: 64, grade: 'B-', points: 8, label: 'Average' },
  { min: 55, max: 59, grade: 'C+', points: 7, label: 'Slightly Above Average' },
  { min: 50, max: 54, grade: 'C', points: 6, label: 'Average' },
  { min: 45, max: 49, grade: 'C-', points: 5, label: 'Slightly Below Average' },
  { min: 40, max: 44, grade: 'D+', points: 4, label: 'Below Average' },
  { min: 35, max: 39, grade: 'D', points: 3, label: 'Poor' },
  { min: 30, max: 34, grade: 'D-', points: 2, label: 'Very Poor' },
  { min: 0, max: 29, grade: 'E', points: 1, label: 'Fail' }
];

// Grade thresholds for quick lookup
export const GRADE_THRESHOLDS = {
  // CBC Scale
  CBC: {
    EE: 80,
    ME: 65,
    AE: 50,
    BE: 0
  },
  // KNEC Scale
  KNEC: {
    A: 80, 'A-': 75, 'B+': 70, B: 65, 'B-': 60,
    'C+': 55, C: 50, 'C-': 45, 'D+': 40, D: 35, 'D-': 30, E: 0
  }
};

/**
 * Calculate grade from score
 * @param {number} score - The percentage score (0-100)
 * @param {string} scale - 'CBC' or 'KNEC' (default: 'CBC')
 * @returns {object} Grade object with grade, label, color, etc.
 */
export function calculateGrade(score, scale = 'CBC') {
  // Validate input
  if (score === null || score === undefined || isNaN(score)) {
    return { grade: 'N/A', label: 'Not Available', color: '#94a3b8' };
  }
  
  // Clamp score to 0-100
  const clampedScore = Math.max(0, Math.min(100, Number(score)));
  
  if (scale === 'CBC') {
    if (clampedScore >= CBC_LEVELS.EE.min) return CBC_LEVELS.EE;
    if (clampedScore >= CBC_LEVELS.ME.min) return CBC_LEVELS.ME;
    if (clampedScore >= CBC_LEVELS.AE.min) return CBC_LEVELS.AE;
    return CBC_LEVELS.BE;
  }
  
  if (scale === 'KNEC') {
    return KNEC_SCALE.find(g => clampedScore >= g.min) || KNEC_SCALE[KNEC_SCALE.length - 1];
  }
  
  throw new Error(`Unknown grading scale: ${scale}`);
}

/**
 * Get grade label only (e.g., "EE", "ME", "A", "B+")
 * @param {number} score 
 * @param {string} scale 
 * @returns {string}
 */
export function getGradeLabel(score, scale = 'CBC') {
  return calculateGrade(score, scale).grade;
}

/**
 * Get grade color for UI styling
 * @param {number} score 
 * @param {string} scale 
 * @returns {string} Hex color code
 */
export function getGradeColor(score, scale = 'CBC') {
  return calculateGrade(score, scale).color;
}

/**
 * Get grade points (for KNEC 12-point scale)
 * @param {number} score 
 * @returns {number} Points (1-12)
 */
export function getGradePoints(score) {
  const grade = calculateGrade(score, 'KNEC');
  return grade.points || 0;
}

/**
 * Calculate mean grade from array of scores
 * @param {number[]} scores 
 * @param {string} scale 
 * @returns {object} { mean, grade, label }
 */
export function calculateMeanGrade(scores, scale = 'CBC') {
  if (!scores || scores.length === 0) {
    return { mean: 0, grade: 'N/A', label: 'No Data' };
  }
  
  const validScores = scores.filter(s => s !== null && !isNaN(s));
  if (validScores.length === 0) {
    return { mean: 0, grade: 'N/A', label: 'No Data' };
  }
  
  const mean = validScores.reduce((a, b) => a + b, 0) / validScores.length;
  const grade = calculateGrade(mean, scale);
  
  return {
    mean: Math.round(mean * 100) / 100,
    grade: grade.grade,
    label: grade.label,
    color: grade.color
  };
}

/**
 * Calculate class ranking from student results
 * @param {Array<{student_id: number, total_marks: number}>} studentResults 
 * @returns {Array} Sorted with rank added
 */
export function calculateRanking(studentResults) {
  // Sort by total marks descending
  const sorted = [...studentResults].sort((a, b) => b.total_marks - a.total_marks);
  
  // Add rank (handle ties)
  let currentRank = 1;
  let previousMarks = null;
  
  return sorted.map((student, index) => {
    if (previousMarks !== null && student.total_marks < previousMarks) {
      currentRank = index + 1;
    }
    previousMarks = student.total_marks;
    
    return {
      ...student,
      rank: currentRank,
      outOf: sorted.length
    };
  });
}

/**
 * Get pass/fail status
 * @param {number} score 
 * @param {number} passMark - Default 50% for CBC, 40% for KNEC
 * @returns {boolean}
 */
export function isPassing(score, passMark = 50) {
  return score >= passMark;
}

/**
 * Get list of failing subjects from results
 * @param {Array<{subject: string, score: number}>} results 
 * @param {number} passMark 
 * @returns {Array} Failing subjects
 */
export function getFailingSubjects(results, passMark = 50) {
  return results.filter(r => r.score < passMark);
}

/**
 * Calculate stream/class statistics
 * @param {number[]} scores 
 * @returns {object} Statistics
 */
export function calculateClassStats(scores) {
  if (!scores || scores.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      highest: 0,
      lowest: 0,
      passCount: 0,
      failCount: 0,
      passRate: 0
    };
  }
  
  const validScores = scores.filter(s => s !== null && !isNaN(s));
  const sorted = [...validScores].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const count = sorted.length;
  
  const mean = sum / count;
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];
  
  const passing = validScores.filter(s => s >= 50);
  
  return {
    count,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    highest: sorted[count - 1],
    lowest: sorted[0],
    passCount: passing.length,
    failCount: count - passing.length,
    passRate: Math.round((passing.length / count) * 100)
  };
}

/**
 * Special marks handling (for absent, cheating, etc.)
 */
export const SPECIAL_MARKS = {
  ABSENT: { code: 'X', label: 'Absent', value: 0, treatAs: 0 },
  CHEATING: { code: 'Y', label: 'Cheating', value: 0, treatAs: 0 },
  NOT_ASSESSED: { code: 'N/A', label: 'Not Assessed', value: null, treatAs: null }
};

/**
 * Parse mark (handle special cases)
 * @param {string|number} mark 
 * @returns {object} { value: number|null, isSpecial: boolean, specialType: string|null }
 */
export function parseMark(mark) {
  if (mark === 'X' || mark === 'ABSENT') {
    return { value: 0, isSpecial: true, specialType: 'ABSENT' };
  }
  if (mark === 'Y' || mark === 'CHEAT') {
    return { value: 0, isSpecial: true, specialType: 'CHEATING' };
  }
  if (mark === 'N/A' || mark === null || mark === undefined || mark === '') {
    return { value: null, isSpecial: true, specialType: 'NOT_ASSESSED' };
  }
  
  const numValue = Number(mark);
  if (isNaN(numValue)) {
    return { value: null, isSpecial: true, specialType: 'INVALID' };
  }
  
  return { value: numValue, isSpecial: false, specialType: null };
}

/**
 * Format score for display (handle decimals, special marks)
 * @param {number|string} score 
 * @param {number} total - Total marks possible
 * @returns {string}
 */
export function formatScore(score, total = 100) {
  const parsed = parseMark(score);
  
  if (parsed.isSpecial) {
    return parsed.specialType;
  }
  
  return `${parsed.value}/${total}`;
}

export default {
  CBC_LEVELS,
  KNEC_SCALE,
  GRADE_THRESHOLDS,
  SPECIAL_MARKS,
  calculateGrade,
  getGradeLabel,
  getGradeColor,
  getGradePoints,
  calculateMeanGrade,
  calculateRanking,
  isPassing,
  getFailingSubjects,
  calculateClassStats,
  parseMark,
  formatScore
};
