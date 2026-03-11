const fs = require('fs');
const path = require('path');

// ── Fix 1: Helpers.jsx — move PAGE_SIZE before pager() ──
const helpersPath = path.join(__dirname, 'src', 'components', 'Helpers.jsx');
let helpers = fs.readFileSync(helpersPath, 'utf8');

if (helpers.indexOf('const PAGE_SIZE') > helpers.indexOf('export const pager')) {
  helpers = helpers.replace(/\r?\n\/\/ page size constant for pager function\r?\nconst PAGE_SIZE = 8;\r?\n?$/, '');
  helpers = helpers.replace(
    /(\/\/ generic pager function \(not a component\))/,
    '// page size constant -- declared here so pager() can reference it\r\nconst PAGE_SIZE = 8;\r\n\r\n$1'
  );
  fs.writeFileSync(helpersPath, helpers, 'utf8');
  process.stdout.write('Fix 1 OK: Helpers.jsx PAGE_SIZE moved before pager()\n');
} else {
  process.stdout.write('Fix 1 SKIP: Helpers.jsx already fixed\n');
}

// ── Fix 2: App.jsx — remove duplicate nav items ──
const appPath = path.join(__dirname, 'src', 'App.jsx');
let app = fs.readFileSync(appPath, 'utf8');

const navPattern = /\/\/ Build nav including admin-only extras[\s\S]*?const fullNav = \[[\s\S]*?\];/;
if (navPattern.test(app)) {
  app = app.replace(navPattern,
    '// nav is already role-filtered via ROLE[role].pages in constants.js\r\n  // teacher also gets reports via constants -- no manual additions needed\r\n  const fullNav = nav;'
  );
  fs.writeFileSync(appPath, app, 'utf8');
  process.stdout.write('Fix 2 OK: App.jsx duplicate nav items removed\n');
} else {
  process.stdout.write('Fix 2 SKIP: App.jsx pattern not found or already fixed\n');
}

// ── Fix 3: ReportsPage.jsx — fix API endpoint + normalise summary keys ──
const reportsPath = path.join(__dirname, 'src', 'pages', 'ReportsPage.jsx');
let reports = fs.readFileSync(reportsPath, 'utf8');
let changed = false;

// 3a. Fix wrong endpoint
if (reports.includes('apiFetch("/reports/grades"')) {
  reports = reports.replace('apiFetch("/reports/grades"', 'apiFetch("/reports/grade-distribution"');
  changed = true;
  process.stdout.write('Fix 3a OK: /reports/grades -> /reports/grade-distribution\n');
} else {
  process.stdout.write('Fix 3a SKIP: endpoint already correct\n');
}

// 3b. Normalise summary keys
const oldThen = `    ]).then(([s, m, a, d, g]) => {
      setSummary(s); setMonthly(m); setAttendance(a); setDefaulters(d); setGrades(g);
    }).catch(console.warn).finally(() => setLoading(false));`;

const newThen = `    ]).then(([s, m, a, d, g]) => {
      const normSummary = s ? {
        students:       s.totalStudents   ?? s.students       ?? 0,
        teachers:       s.totalTeachers   ?? s.teachers       ?? 0,
        feesCollected:  s.totalCollected  ?? s.feesCollected  ?? 0,
        feesPending:    s.totalPending    ?? s.feesPending    ?? 0,
        openDiscipline: s.openDiscipline  ?? 0,
      } : null;
      setSummary(normSummary); setMonthly(m); setAttendance(a); setDefaulters(d);
      setGrades((g || []).map(row => ({
        ...row,
        avg_score:  row.avg_score  ?? row.avgScore  ?? 0,
        class_name: row.class_name ?? row.subject   ?? '',
      })));
    }).catch(console.warn).finally(() => setLoading(false));`;

if (reports.includes('setSummary(s); setMonthly(m); setAttendance(a); setDefaulters(d); setGrades(g);')) {
  reports = reports.replace(oldThen, newThen);
  changed = true;
  process.stdout.write('Fix 3b OK: ReportsPage.jsx summary key normalisation added\n');
} else {
  process.stdout.write('Fix 3b SKIP: already fixed or pattern not found\n');
}

if (changed) fs.writeFileSync(reportsPath, reports, 'utf8');

process.stdout.write('\nAll fixes applied.\n');
