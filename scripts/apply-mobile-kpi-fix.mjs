#!/usr/bin/env node
/**
 * apply-mobile-kpi-fix.mjs
 * Run from repo root: node scripts/apply-mobile-kpi-fix.mjs
 * Safe idempotent patches for Reports + Expenditures KPI mobile layout.
 */
import fs from "fs";
import path from "path";

function patchFile(rel, transforms) {
  const p = path.join(process.cwd(), rel);
  let t = fs.readFileSync(p, "utf8");
  const before = t;
  for (const [name, fn] of transforms) {
    const next = fn(t);
    if (next === t) console.warn("no-op:", name, "on", rel);
    else console.log("ok:", name, "on", rel);
    t = next;
  }
  if (t !== before) {
    fs.writeFileSync(p, t);
    console.log("wrote", rel);
  } else {
    console.log("unchanged", rel);
  }
}

patchFile("src/pages/ReportsPage.jsx", [
  ["import StatCard", (t) => {
    if (t.includes('from "../components/ui/StatCard"')) return t;
    return t.replace(
      'import EmptyState from "../components/ui/EmptyState";',
      'import EmptyState from "../components/ui/EmptyState";\nimport StatCard from "../components/ui/StatCard";'
    );
  }],
  ["remove local StatCard", (t) => t.replace(
    /const StatCard = \(\{ label, value, tone = "default" \}\) => \{[\s\S]*?\n\};\n/,
    ""
  )],
  ["summary grid", (t) => t.replace(
    /\{summary && \(\s*<div style=\{\{ display: "flex", flexWrap: "wrap", gap: "var\(--space-3\)" \}\}>[\s\S]*?Open Discipline[\s\S]*?<\/div>\s*\)\}/,
    `{summary && (
        <div className="ec-kpi-grid">
          <StatCard label="Active Students" value={summary.students} color="var(--color-info)" />
          <StatCard label="Active Teachers" value={summary.teachers} color="var(--color-info)" />
          <StatCard label="Fees Collected" value={money(summary.feesCollected)} color="var(--color-success)" />
          <StatCard label="Fees Pending" value={money(summary.feesPending)} color="var(--color-warning)" />
          <StatCard label="Total Expenses" value={money(summary.totalExpenses)} color="var(--color-danger)" />
          <StatCard label="Net Cashflow" value={money(summary.netCashflow)} color={summary.netCashflow >= 0 ? "var(--color-success)" : "var(--color-danger)"} />
          <StatCard label="Open Discipline" value={summary.openDiscipline} color="var(--color-danger)" />
        </div>
      )}`
  )],
]);

patchFile("src/pages/ExpendituresPage.jsx", [
  ["import StatCard", (t) => {
    if (t.includes('from "../components/ui/StatCard"')) return t;
    if (t.includes('import Card from "../components/ui/Card";')) {
      return t.replace(
        'import Card from "../components/ui/Card";',
        'import Card from "../components/ui/Card";\nimport StatCard from "../components/ui/StatCard";'
      );
    }
    return t;
  }],
  ["remove local StatCard", (t) => t.replace(
    /function StatCard\(\{ label, value, tone = "default", hint \}\) \{[\s\S]*?\n\}\n\nStatCard\.propTypes = \{[\s\S]*?\n\};\n\n/,
    ""
  )],
  ["kpi flex to grid", (t) => t.replace(
    'style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}',
    'className="ec-kpi-grid"',
    1
  )],
  ["tone to color danger", (t) => t.replace(/tone="danger"/g, 'color="var(--color-danger)"')],
  ["tone to color warning", (t) => t.replace(/tone="warning"/g, 'color="var(--color-warning)"')],
  ["tone to color info", (t) => t.replace(/tone="info"/g, 'color="var(--color-info)"')],
  ["tone to color success", (t) => t.replace(/tone="success"/g, 'color="var(--color-success)"')],
  ["hint to title", (t) => t.replace(/\bhint=/g, "title=")],
  ["two col layout", (t) => t.replace(
    'gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)"',
    'gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))"'
  )],
]);

const KPI = 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))';
const OLD = 'repeat(auto-fit, minmax(200px, 1fr))';
const OLD2 = 'repeat(auto-fill, minmax(200px, 1fr))';
for (const rel of [
  "src/pages/AnalyticsPage.jsx",
  "src/pages/TrialBalancePage.jsx",
  "src/pages/IncomeStatementPage.jsx",
  "src/pages/BalanceSheetPage.jsx",
  "src/pages/ChartOfAccountsPage.jsx",
  "src/pages/GeneralLedgerPage.jsx",
  "src/pages/JournalEntriesPage.jsx",
  "src/pages/DiscountsReportPage.jsx",
  "src/pages/PortalDashboardPage.jsx",
]) {
  patchFile(rel, [
    ["minmax 200 -> 140", (t) => t.replaceAll(OLD, KPI).replaceAll(OLD2, 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))')],
  ]);
}

console.log("Done. Review git diff, then commit.");
