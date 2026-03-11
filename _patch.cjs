
const fs = require('fs');
const path = require('path');

// ── Fix 1: Helpers.jsx — move PAGE_SIZE before pager() ──
const helpersPath = path.join(__dirname, 'src', 'components', 'Helpers.jsx');
let helpers = fs.readFileSync(helpersPath, 'utf8');

// Remove the trailing PAGE_SIZE block (CRLF-safe)
helpers = helpers.replace(/[\r\n]+\/\/ page size constant for pager function[\r\n]+const PAGE_SIZE = 8;[\r\n]*$/, '');

// Insert PAGE_SIZE before the pager comment (CRLF-safe)
helpers = helpers.replace(
  /(\/\/ generic pager function \(not a component\))/,
  '// page size constant -- declared here so pager() can reference it\r\nconst PAGE_SIZE = 8;\r\n\r\n$1'
);

fs.writeFileSync(helpersPath, helpers, 'utf8');
console.log('Fix 1 DONE: Helpers.jsx PAGE_SIZE moved before pager()');

// ── Fix 2: App.jsx — remove duplicate nav items ──
const appPath = path.join(__dirname, 'src', 'App.jsx');
let app = fs.readFileSync(appPath, 'utf8');

// Match the entire "Build nav including admin-only extras" block
const navPattern = /\/\/ Build nav including admin-only extras[\s\S]*?const fullNav = \[[\s\S]*?\];/;
if (navPattern.test(app)) {
  app = app.replace(
    navPattern,
    '// nav is already role-filtered via ROLE[role].pages in constants.js\r\n  // teacher also gets timetable via constants -- no manual additions needed\r\n  const fullNav = nav;'
  );
  fs.writeFileSync(appPath, app, 'utf8');
  console.log('Fix 2 DONE: App.jsx duplicate nav items removed');
} else {
  console.log('Fix 2 SKIP: App.jsx pattern not found or already fixed');
}

// ── Fix 3: ReportsPage.jsx — fix API endpoint + normalise summary keys ──
const reportsPath = path.join(__dirname, 'src', 'pages', 'ReportsPage.jsx');
let reports = fs.readFileSync(reportsPath, 'utf8');
let changed = false;

// 3a. Fix wrong endpoint /reports/grades -> /reports/grade-distribution
if (reports.includes('apiFetch("/reports/grades"')) {
  reports = reports.replace('apiFetch("/reports/grades"', 'apiFetch("/reports/grade-distribution"');
  changed = true;
  console.log('Fix 3a DONE: /reports/grades -> /reports/grade-distribution');
} else {
  console.log('Fix 3a SKIP: endpoint already correct');
}

// 3b. Normalise summary keys
const oldBlock = `    ]).then(([s, m, a, d, g]) => {\n      setSummary(s); setMonthly(m); setAttendance(a); setDefaulters(d); setGrades(g);\n    }).catch(console.warn).finally(() => setLoading(false));`;
const newBlock = `    ]).then(([s, m, a, d, g]) => {\n      // Normalise backend key names to what the UI expects\n      const normSummary = s ? {\n        students:       s.totalStudents   ?? s.students       ?? 0,\n        teachers:       s.totalTeachers   ?? s.teachers       ?? 0,\n        feesCollected:  s.totalCollected  ?? s.feesCollected  ?? 0,\n        feesPending:    s.totalPending    ?? s.feesPending    ?? 0,\n        openDiscipline: s.openDiscipline  ?? 0,\n      } : null;\n      setSummary(normSummary); setMonthly(m); setAttendance(a); setDefaulters(d);\n      // grade-distribution may return avgScore -- normalise to avg_score\n      setGrades((g || []).map(row => ({\n        ...row,\n        avg_score:  row.avg_score  ?? row.avgScore  ?? 0,\n        class_name: row.class_name ?? row.subject   ?? '',\n      })));\n    }).catch(console.warn).finally(() => setLoading(false));`;

if (reports.includes('setSummary(s); setMonthly(m); setAttendance(a); setDefaulters(d); setGrades(g);')) {
  reports = reports.replace(oldBlock, newBlock);
  changed = true;
  console.log('Fix 3b DONE: ReportsPage.jsx summary key normalisation added');
} else {
  console.log('Fix 3b SKIP: already fixed or pattern not found');
}

if (changed) fs.writeFileSync(reportsPath, reports, 'utf8');

console.log('\n✅ All fixes applied. Run: npm run dev');
