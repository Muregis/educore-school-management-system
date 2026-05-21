import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateClassRankings } from '../src/services/rankingService.js';

test('ranking.calculateClassRankings computes rankings and returns camelCase fields', () => {
  const results = [
    { student_id: 1, student_name: 'A', subject: 'Math', marks: 80, total_marks: 100 },
    { student_id: 1, student_name: 'A', subject: 'Eng', marks: 70, total_marks: 100 },
    { student_id: 2, student_name: 'B', subject: 'Math', marks: 60, total_marks: 100 },
    { student_id: 2, student_name: 'B', subject: 'Eng', marks: 65, total_marks: 100 }
  ];

  const out = calculateClassRankings(results);
  assert.ok(Array.isArray(out.students));
  assert.equal(out.students.length, 2);
  const s1 = out.students.find(s => String(s.student_id) === '1');
  assert.ok(typeof s1.meanScore === 'number');
  assert.ok('overallGrade' in s1);
  assert.ok('studentName' in s1);
});
