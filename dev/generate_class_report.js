#!/usr/bin/env node
// Simple report generator for classroom results
// Outputs: students sorted by overall performance, per-subject marks, then subject means and class summary

const sample = [
  { admission: 1, name: 'Raymond Otieno', Math: 62, English: 84, Kiswahili: 76, IntSci: 68, CCA: 82, SST: 76 },
  { admission: 2, name: 'Prince Gabriel', Math: 60, English: 82, Kiswahili: 76, IntSci: 68, CCA: 74, SST: 84 },
  { admission: 3, name: 'Claire Wanjiku', Math: 50, English: 74, Kiswahili: 76, IntSci: 74, CCA: 80, SST: 76 },
  { admission: 4, name: 'Raziki Selphine', Math: 23, English: 84, Kiswahili: 76, IntSci: 66, CCA: 68, SST: 72 },
  { admission: 5, name: 'Dahlia Carisma', Math: 50, English: 70, Kiswahili: 60, IntSci: 70, CCA: 66, SST: 70 },
  { admission: 6, name: 'James Mumo', Math: 70, English: 60, Kiswahili: 60, IntSci: 62, CCA: 62, SST: 64 }
];

const subjects = ['Math','English','Kiswahili','IntSci','CCA','SST'];

function calcTotals(data) {
  return data.map(s => {
    const total = subjects.reduce((acc, sub) => acc + (Number(s[sub]) || 0), 0);
    const mean = +(total / subjects.length).toFixed(2);
    return { ...s, total, mean };
  });
}

function subjectMeans(data) {
  const sums = {};
  subjects.forEach(sub => sums[sub] = 0);
  data.forEach(s => {
    subjects.forEach(sub => sums[sub] += Number(s[sub] || 0));
  });
  return subjects.map(sub => ({ subject: sub, mean: +(sums[sub] / data.length).toFixed(2) }));
}

function classSummary(totals) {
  const means = totals.map(t => t.mean);
  const classMean = +(means.reduce((a,b) => a+b, 0) / means.length).toFixed(2);
  const highest = Math.max(...means);
  const lowest = Math.min(...means);
  return { classMean, highest, lowest, count: totals.length };
}

function printReport(data) {
  const totals = calcTotals(data);
  const sorted = [...totals].sort((a,b) => b.total - a.total);

  console.log('CLASS REPORT — Sorted by Overall Performance (TOTAL)');
  console.log('='.repeat(80));
  const header = ['#','Admission','Name', ...subjects, 'TOTAL','MEAN'];
  console.log(header.join('\t'));

  sorted.forEach((s, idx) => {
    const row = [idx+1, s.admission, s.name, ...subjects.map(sub => s[sub]), s.total, s.mean];
    console.log(row.join('\t'));
  });

  console.log('\nSUBJECT AVERAGES');
  console.log('-'.repeat(80));
  const means = subjectMeans(data);
  means.forEach(m => console.log(`${m.subject}: ${m.mean}%`));

  console.log('\nCLASS SUMMARY');
  console.log('-'.repeat(80));
  const summary = classSummary(totals);
  console.log(`Students: ${summary.count}`);
  console.log(`Class mean (average of student means): ${summary.classMean}%`);
  console.log(`Highest student mean: ${summary.highest}%`);
  console.log(`Lowest student mean: ${summary.lowest}%`);
}

printReport(sample);

// To use with real data: replace `sample` with JSON import or CSV parsing
