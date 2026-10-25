import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getClassLevelRank, compareClasses, sortClasses } from '../src/lib/classLevels.js';

test('classLevels: preschool classes sort before primary', () => {
  assert.ok(getClassLevelRank('Playgroup') < getClassLevelRank('PP1'));
  assert.ok(getClassLevelRank('PP1') < getClassLevelRank('PP2'));
  assert.ok(getClassLevelRank('PP2') < getClassLevelRank('Grade 1'));
});

test('classLevels: numeric grades sort by level, avoiding alphabetical pitfalls (Grade 2 before Grade 10)', () => {
  const unordered = ['Grade 10', 'Grade 2', 'Grade 1', 'Grade 7', 'Grade 12', 'Grade 8', 'Grade 9'];
  const sorted = sortClasses(unordered);
  assert.deepEqual(sorted, [
    'Grade 1',
    'Grade 2',
    'Grade 7',
    'Grade 8',
    'Grade 9',
    'Grade 10',
    'Grade 12',
  ]);
});

test('classLevels: PP1 and PP2 sort before Grade 1 (not alphabetically after Grade 9)', () => {
  const unordered = ['Grade 8', 'PP1', 'Grade 1', 'PP2', 'Playgroup'];
  const sorted = sortClasses(unordered);
  assert.deepEqual(sorted, ['Playgroup', 'PP1', 'PP2', 'Grade 1', 'Grade 8']);
});

test('classLevels: same grade with different streams preserves grade level and sorts streams naturally', () => {
  const unordered = ['Grade 8 Alpha', 'Grade 7 West', 'Grade 7 East', 'Grade 1 Red'];
  const sorted = sortClasses(unordered);
  assert.deepEqual(sorted, [
    'Grade 1 Red',
    'Grade 7 East',
    'Grade 7 West',
    'Grade 8 Alpha',
  ]);
});

test('classLevels: Cambridge IGCSE Years sort numerically from Year 1 through Year 13', () => {
  const unordered = ['Year 11', 'Year 2', 'Year 1', 'Year 13', 'Year 9', 'Year 10'];
  const sorted = sortClasses(unordered);
  assert.deepEqual(sorted, ['Year 1', 'Year 2', 'Year 9', 'Year 10', 'Year 11', 'Year 13']);
});

test('classLevels: College / TVET cohorts and semesters sort in academic progression', () => {
  const unordered = [
    'Year 2 Sem 1',
    'Certificate Level',
    'Year 1 Sem 2',
    'Diploma Year 1',
    'Year 1 Sem 1',
  ];
  const sorted = sortClasses(unordered);
  assert.deepEqual(sorted, [
    'Certificate Level',
    'Diploma Year 1',
    'Year 1 Sem 1',
    'Year 1 Sem 2',
    'Year 2 Sem 1',
  ]);
});

test('classLevels: compareClasses supports both string names and class objects with class_order', () => {
  const objList = [
    { class_name: 'Grade 8', class_order: 8 },
    { class_name: 'Grade 1', class_order: 1 },
    { class_name: 'PP1', class_order: 0 }, // fallback to level rank
  ];
  const sorted = [...objList].sort(compareClasses);
  assert.equal(sorted[0].class_name, 'PP1');
  assert.equal(sorted[1].class_name, 'Grade 1');
  assert.equal(sorted[2].class_name, 'Grade 8');
});
