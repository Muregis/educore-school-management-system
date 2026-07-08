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

test('ranking.calculateClassRankings auto-detects subject count and excludes students with fewer subjects', () => {
  const results = [
    { student_id: 1, student_name: 'A', subject: 'Math', marks: 80, total_marks: 100 },
    { student_id: 1, student_name: 'A', subject: 'Eng', marks: 70, total_marks: 100 },
    { student_id: 1, student_name: 'A', subject: 'Sci', marks: 90, total_marks: 100 },
    { student_id: 2, student_name: 'B', subject: 'Math', marks: 60, total_marks: 100 },
    { student_id: 2, student_name: 'B', subject: 'Eng', marks: 65, total_marks: 100 },
    { student_id: 2, student_name: 'B', subject: 'Sci', marks: 75, total_marks: 100 },
    { student_id: 3, student_name: 'C', subject: 'Math', marks: 95, total_marks: 100 },
    { student_id: 3, student_name: 'C', subject: 'Eng', marks: 85, total_marks: 100 },
  ];

  const out = calculateClassRankings(results);
  assert.equal(out.students.length, 2, 'Only students with all 3 subjects should be ranked');
  const ids = out.students.map(s => String(s.student_id));
  assert.ok(ids.includes('1'), 'Student 1 with all subjects should be ranked');
  assert.ok(ids.includes('2'), 'Student 2 with all subjects should be ranked');
  assert.ok(!ids.includes('3'), 'Student 3 with only 2 subjects should NOT be ranked');
});
