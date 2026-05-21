import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateMeanScore, calculateGradeFromMarks } from '../src/lib/grading.js';

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
