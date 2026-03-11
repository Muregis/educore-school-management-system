const fs = require('fs');
const path = require('path');

// ── Fix 1: Helpers.jsx — move PAGE_SIZE before pager() ──
const helpersPath = path.join(__dirname, 'src', 'components', 'Helpers.jsx');
let helpers = fs.readFileSync(helpersPath, 'utf8');

// Only apply if PAGE_SIZE is still at the bottom (after pager)
if (/\/\/ page size constant for pager function/.test(helpers) && helpers.indexOf('const PAGE_SIZE') > helpers.indexOf('export const pager')) {
  // Remove trailing PAGE_SIZE block (handles both LF and CRLF)
  helpers = helpers.replace(/\r?\n\/\/ page size constant for pager function\r?\nconst PAGE_SIZE = 8;\r?\n?$/, '');
  // Insert PAGE_SIZE constant before the pager comment
  helpers = helpers.replace(
    /(\/\/ generic pager function \(not a component\))/,
    '// page size constant -- declared here so pager() can reference it\nconst PAGE_SIZE = 8;\n\n$1'
  );
  fs.writeFileSync(helpersPath, helpers, 'utf8');
  console.log('Fix 1 OK: Helpers.jsx PAGE_SIZE moved before pager()');
} else {
  console.log('Fix 1 SKIP: Helpers.jsx already fixed or pattern not found');
}

// ── Fix 2: App.jsx — remove duplicate nav items for admin/teacher ──
// constants.js already includes timetable, reports, accounts in admin.pages
// and timetable in teacher.pages, so fullNav must NOT re-add them.
const appPath = path.join(__dirname, 'src', 'App.jsx');
let app = fs.readFileSync(appPath, 'utf8');

const navPattern = /\/\/ Build nav including admin-only extras[\s\S]*?const fullNav = \[[\s\S]*?\];/;
if (navPattern.test(app)) {
  app = app.replace(navPattern,
    '// nav is already role-filtered via ROLE[role].pages in constants.js\n  // teacher also gets reports via constants -- no manual additions needed\n  const fullNav = nav;'
  );
  fs.writeFileSync(appPath, app, 'utf8');
  console.log('Fix 2 OK: App.jsx duplicate nav items removed');
} else {
  console.log('Fix 2 SKIP: App.jsx pattern not found or already fixed');
}

// ── Fix 3: ReportsPage.jsx — fix API endpoint + normalise summary keys ──
const reportsPath = path.join(__dirname, 'src', 'pages', 'ReportsPage.jsx');
let reports = fs.readFileSync(reportsPath, 'utf8');
let reportsChanged = false;

// 3a. Fix wrong endpoint /reports/grades -> /reports/grade-distribution
if (reports.includes("apiFetch(\"/reports/grades\"")) {
  reports = reports.replace(
    'apiFetch("/reports/grades"',
    'apiFetch("/reports/grade-distribution"'
  );
  reportsChanged = true;
  console.log('Fix 3a OK: /reports/grades -> /reports/grade-distribution');
} else {
  console.log('Fix 3a SKIP: endpoint already correct or not found');
}

// 3b. Normalise summary keys returned by backend
const oldThen = `.then(([s, m, a, d, g]) => {
      setSummary(s); setMonthly(m); setAttendance(a); setDefaulters(d); setGrades(g);
    })`;
const newThen = `.then(([s, m, a, d, g]) => {
      // Normalise backend key names to what the UI expects
      const normSummary = s ? {
        students:       s.totalStudents   ?? s.students       ?? 0,
        teachers:       s.totalTeachers   ?? s.teachers       ?? 0,
        feesCollected:  s.totalCollected  ?? s.feesCollected  ?? 0,
        feesPending:    s.totalPending    ?? s.feesPending    ?? 0,
        openDiscipline: s.openDiscipline  ?? 0,
      } : null;
      setSummary(normSummary); setMonthly(m); setAttendance(a); setDefaulters(d);
      // grade-distribution may return avgScore -- normalise to avg_score
      setGrades((g || []).map(row => ({
        ...row,
        avg_score:  row.avg_score  ?? row.avgScore  ?? 0,
        class_name: row.class_name ?? row.subject   ?? '',
      })));
    })`;

if (reports.includes('setSummary(s); setMonthly(m); setAttendance(a); setDefaulters(d); setGrades(g);')) {
  reports = reports.replace(oldThen, newThen);
  reportsChanged = true;
  console.log('Fix 3b OK: ReportsPage.jsx summary key normalisation added');
} else {
  console.log('Fix 3b SKIP: already fixed or pattern not found');
}

if (reportsChanged) fs.writeFileSync(reportsPath, reports, 'utf8');

console.log('\nAll fixes applied. Run: npm run dev');
