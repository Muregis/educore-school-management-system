import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateMeanScore,
  calculateGradeFromMarks,
  calculateGrade,
  isPassing,
  getGradeColor,
  getGradePoints,
} from '../src/lib/grading.js';

test('grading.calculateMeanScore calculates mean (per-entry average) and percentage correctly', () => {
  const results = [
    { marks: 40, total_marks: 50 }, // 80%
    { marks: 30, total_marks: 50 }, // 60%
    { marks: 25, total_marks: 50 }  // 50%
  ];

  const res = calculateMeanScore(results);
  // mean of percentages = (80+60+50)/3 = 63.333...
  assert.equal(typeof res.mean, 'number');
  assert.equal(Math.round(res.mean * 100) / 100, 63.33);
  // overall percentage (totalMarks/totalPossible) = (95/150)*100 = 63.333...
  assert.equal(Math.round(res.percentage * 100) / 100, 63.33);
  assert.equal(res.count, 3);
});

test('grading.calculateGradeFromMarks returns grade object for marks', () => {
  const g = calculateGradeFromMarks(45, 50, 'cbc'); // 90%
  assert.equal(g.grade, 'EE');
});

test('grading supports multi-curriculum grading scales (IGCSE, College, CBC)', () => {
  // IGCSE
  const igcseAStar = calculateGrade(92, 'igcse');
  assert.equal(igcseAStar.grade, 'A*');
  assert.equal(isPassing(92, 'igcse'), true);
  assert.equal(getGradePoints('A*'), 8);

  // College / Tertiary
  const collegeDist = calculateGrade(85, 'college');
  assert.equal(collegeDist.grade, 'Distinction');
  assert.equal(getGradeColor('Distinction'), '#16a34a');
  assert.equal(getGradePoints('Distinction'), 4);

  const collegeCredit = calculateGrade(70, 'college');
  assert.equal(collegeCredit.grade, 'Credit');
  assert.equal(isPassing(70, 'college'), true);

  const collegeFail = calculateGrade(35, 'college');
  assert.equal(collegeFail.grade, 'Fail');
  assert.equal(isPassing(35, 'college'), false);
});
