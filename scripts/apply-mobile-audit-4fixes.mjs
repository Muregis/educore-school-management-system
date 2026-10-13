#!/usr/bin/env node
import fs from "fs";

function softMinWidth(file, pairs) {
  if (!fs.existsSync(file)) return;
  let t = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const [old, neu] of pairs) {
    if (t.includes(old)) {
      t = t.split(old).join(neu);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, t);
    console.log("softened", file);
  }
}

const statCard = `import PropTypes from "prop-types";
import Card from "./Card";

const TONE_COLORS = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  default: "var(--color-primary)",
};

/**
 * KPI metric card — mobile-first, never clips labels or currency.
 * Accepts label/title, value, color or tone, optional subtitle/hint, optional onClick.
 */
export default function StatCard({
  label,
  value,
  color,
  tone,
  title,
  subtitle,
  hint,
  loading = false,
  onClick,
}) {
  const heading = label || title || "";
  const sub = subtitle || hint || "";
  const valueStr = loading ? "…" : String(value ?? "");
  const borderColor = color || TONE_COLORS[tone] || TONE_COLORS.default;

  return (
    <Card
      className="ec-stat-card"
      onClick={onClick}
      style={{
        position: "relative",
        overflow: "visible",
        contain: "none",
        minHeight: 72,
        minWidth: 0,
        maxWidth: "100%",
        padding: "12px 14px",
        borderLeft: \`4px solid \${borderColor}\`,
        cursor: onClick ? "pointer" : undefined,
      }}
      title={title && label ? title : undefined}
    >
      {onClick ? (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            color: "var(--color-text-muted)",
            opacity: 0.45,
            fontSize: 14,
          }}
          aria-hidden
        >
          →
        </div>
      ) : null}
      <div
        className="ec-stat-label"
        style={{
          color: "var(--color-text-muted)",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          lineHeight: 1.3,
          whiteSpace: "normal",
          overflow: "visible",
          wordBreak: "break-word",
          paddingRight: onClick ? 16 : 0,
        }}
      >
        {heading}
      </div>
      <div
        className="ec-stat-value"
        style={{
          marginTop: 6,
          fontSize: valueStr.length > 12 ? 13 : valueStr.length > 8 ? 15 : 18,
          fontWeight: 800,
          color: "var(--color-text-primary)",
          lineHeight: 1.25,
          whiteSpace: "normal",
          overflow: "visible",
          wordBreak: "break-word",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valueStr}
      </div>
      {sub ? (
        <div
          className="ec-stat-sub"
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--color-text-muted)",
            lineHeight: 1.3,
            whiteSpace: "normal",
            overflow: "visible",
            wordBreak: "break-word",
          }}
        >
          {sub}
        </div>
      ) : null}
    </Card>
  );
}

StatCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
  tone: PropTypes.oneOf(["success", "warning", "danger", "info", "default"]),
  title: PropTypes.string,
  subtitle: PropTypes.string,
  hint: PropTypes.string,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
};
`;
fs.writeFileSync("src/components/ui/StatCard.jsx", statCard);
console.log("wrote StatCard");

// ReportsPage
{
  let t = fs.readFileSync("src/pages/ReportsPage.jsx", "utf8");
  if (!t.includes("components/ui/StatCard")) {
    t = t.replace(
      'import EmptyState from "../components/ui/EmptyState";',
      'import EmptyState from "../components/ui/EmptyState";\nimport StatCard from "../components/ui/StatCard";'
    );
  }
  t = t.replace(
    /\nconst StatCard = \(\{ label, value, tone = "default" \}\) => \{[\s\S]*?\n\};\n/,
    "\n"
  );
  t = t.replace(
    `<div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>\n          <StatCard label="Active Students"  value={summary.students}               tone="info" />\n          <StatCard label="Active Teachers"  value={summary.teachers}               tone="info" />\n          <StatCard label="Fees Collected"   value={money(summary.feesCollected)}   tone="success" />\n          <StatCard label="Fees Pending"     value={money(summary.feesPending)}     tone="warning" />\n          <StatCard label="Total Expenses"   value={money(summary.totalExpenses)}   tone="danger" />\n          <StatCard label="Net Cashflow"     value={money(summary.netCashflow)}     tone={summary.netCashflow >= 0 ? "success" : "danger"} />\n          <StatCard label="Open Discipline"  value={summary.openDiscipline}         tone="danger" />\n        </div>`,
    `<div className="ec-kpi-grid">\n          <StatCard label="Active Students"  value={summary.students}               tone="info" />\n          <StatCard label="Active Teachers"  value={summary.teachers}               tone="info" />\n          <StatCard label="Fees Collected"   value={money(summary.feesCollected)}   tone="success" />\n          <StatCard label="Fees Pending"     value={money(summary.feesPending)}     tone="warning" />\n          <StatCard label="Total Expenses"   value={money(summary.totalExpenses)}   tone="danger" />\n          <StatCard label="Net Cashflow"     value={money(summary.netCashflow)}     tone={summary.netCashflow >= 0 ? "success" : "danger"} />\n          <StatCard label="Open Discipline"  value={summary.openDiscipline}         tone="danger" />\n        </div>`
  );
  fs.writeFileSync("src/pages/ReportsPage.jsx", t);
  console.log("Reports patched", t.includes("ec-kpi-grid") && !t.includes("const StatCard"));
}

// Expenditures
{
  let t = fs.readFileSync("src/pages/ExpendituresPage.jsx", "utf8");
  if (!t.includes("components/ui/StatCard")) {
    t = t.replace(
      'import Badge from "../components/ui/Badge";',
      'import Badge from "../components/ui/Badge";\nimport StatCard from "../components/ui/StatCard";'
    );
  }
  t = t.replace(
    /\nfunction StatCard\(\{ label, value, tone = "default", hint \}\) \{[\s\S]*?\n\}\n\nStatCard\.propTypes = \{[\s\S]*?\n\};\n/,
    "\n"
  );
  t = t.replace(
    `<div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>\n        <StatCard label="Total Expenses" value={money(summary?.totals?.total || 0)} tone="danger" hint="Manual expenses plus paid payroll" />\n        <StatCard label="Payroll Costs" value={money(summary?.totals?.payroll || 0)} tone="warning" hint={\`\${summary?.totals?.payrollEntries || 0} paid payslips\`} />\n        <StatCard label="Manual Expenses" value={money(summary?.totals?.manual || 0)} tone="info" hint={\`\${summary?.totals?.transactions || 0} recorded items\`} />\n        <StatCard label="This Month" value={money(currentMonthTotal)} tone="success" hint="All expenses dated this month" />\n      </div>`,
    `<div className="ec-kpi-grid">\n        <StatCard label="Total Expenses" value={money(summary?.totals?.total || 0)} tone="danger" hint="Manual expenses plus paid payroll" />\n        <StatCard label="Payroll Costs" value={money(summary?.totals?.payroll || 0)} tone="warning" hint={\`\${summary?.totals?.payrollEntries || 0} paid payslips\`} />\n        <StatCard label="Manual Expenses" value={money(summary?.totals?.manual || 0)} tone="info" hint={\`\${summary?.totals?.transactions || 0} recorded items\`} />\n        <StatCard label="This Month" value={money(currentMonthTotal)} tone="success" hint="All expenses dated this month" />\n      </div>`
  );
  fs.writeFileSync("src/pages/ExpendituresPage.jsx", t);
  console.log("Expenditures patched");
}

// Portal
{
  let t = fs.readFileSync("src/pages/PortalDashboardPage.jsx", "utf8");
  if (!t.includes("components/ui/StatCard")) {
    t = t.replace(
      'import EmptyState from "../components/ui/EmptyState";',
      'import EmptyState from "../components/ui/EmptyState";\nimport StatCard from "../components/ui/StatCard";'
    );
  }
  const idx = t.indexOf("\nfunction StatCard(");
  if (idx >= 0) {
    const rest = t.slice(idx + 1);
    let depth = 0, started = false, end = null;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "{") { depth++; started = true; }
      else if (rest[i] === "}") {
        depth--;
        if (started && depth === 0) { end = i + 1; break; }
      }
    }
    if (end != null) {
      const after = rest.slice(end);
      const m = after.match(/^\s*StatCard\.propTypes\s*=\s*\{[\s\S]*?\};\s*/);
      const extra = m ? m[0].length : 0;
      t = t.slice(0, idx) + rest.slice(end + extra);
    }
  }
  fs.writeFileSync("src/pages/PortalDashboardPage.jsx", t);
  console.log("Portal patched", !t.includes("function StatCard"));
}

softMinWidth("src/pages/AnalyticsPage.jsx", [["minWidth: 180", "minWidth: 0"]]);
softMinWidth("src/pages/LibraryPage.jsx", [['minWidth: "200px"', "minWidth: 0"], ['minWidth: "150px"', "minWidth: 0"]]);
softMinWidth("src/pages/SubjectsPage.jsx", [['minWidth: "200px"', "minWidth: 0"], ['minWidth: "180px"', "minWidth: 0"]]);
softMinWidth("src/pages/UpdateRequestsPage.jsx", [['minWidth: "200px"', "minWidth: 0"]]);
softMinWidth("src/pages/PendingPlansPage.jsx", [["minWidth: 280", "minWidth: 0"], ["minWidth: 120", "minWidth: 0"]]);
softMinWidth("src/pages/AdminSettings.jsx", [["minWidth: 200", "minWidth: 0"]]);

const cssPath = "src/styles/layout-foundation.css";
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes("FIX 3 — Raw tables")) {
  css += `\n\n/* ==========================================================================\n * FIX 3 — Raw tables on mobile: always scroll horizontally, never overflow page\n * FIX 4 — Soft min-width: never force 160px+ tracks on phones\n * ========================================================================== */\n@media screen and (max-width: 767px) {\n  .ec-page-content table:not(.ui-table),\n  .ec-page-content .ui-table {\n    max-width: 100%;\n  }\n\n  .ec-page-content table {\n    display: block;\n    width: 100%;\n    overflow-x: auto;\n    -webkit-overflow-scrolling: touch;\n    border-collapse: collapse;\n  }\n\n  .ec-page-content thead,\n  .ec-page-content tbody,\n  .ec-page-content tr {\n    display: table;\n    width: 100%;\n    table-layout: auto;\n  }\n\n  .ui-table-wrap .ui-table-scroll {\n    display: none !important;\n  }\n  .ui-table-wrap .ui-table-mobile {\n    display: block !important;\n  }\n\n  .ec-page-content [style*="min-width: 1"],\n  .ec-page-content [style*="min-width:2"],\n  .ec-page-content [style*="minWidth"] {\n    min-width: 0 !important;\n  }\n}\n\n@media screen and (min-width: 768px) {\n  .ui-table-wrap .ui-table-scroll {\n    display: block;\n  }\n  .ui-table-wrap .ui-table-mobile {\n    display: none !important;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css);
  console.log("CSS appended");
} else {
  console.log("CSS already present");
}

console.log("ALL DONE");
