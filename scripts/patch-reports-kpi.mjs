#!/usr/bin/env node
/** Patch ReportsPage.jsx only: shared StatCard + ec-kpi-grid. Idempotent. */
import fs from "fs";
import path from "path";

const rel = "src/pages/ReportsPage.jsx";
const p = path.join(process.cwd(), rel);
let t = fs.readFileSync(p, "utf8");

if (t.trim() === "PLACEHOLDER_WILL_REPLACE" || t.includes("PLACEHOLDER")) {
  console.error("ERROR: ReportsPage.jsx is a PLACEHOLDER. Restore from main first:");
  console.error("  git checkout main -- src/pages/ReportsPage.jsx");
  console.error("  node scripts/patch-reports-kpi.mjs");
  process.exit(1);
}

if (t.includes('className="ec-kpi-grid"') && t.includes('from "../components/ui/StatCard"') && !t.includes('minWidth: "160px"')) {
  console.log("ReportsPage already patched");
  process.exit(0);
}

if (!t.includes('from "../components/ui/StatCard"')) {
  if (!t.includes('import EmptyState from "../components/ui/EmptyState";')) {
    console.error("Cannot find EmptyState import");
    process.exit(1);
  }
  t = t.replace(
    'import EmptyState from "../components/ui/EmptyState";',
    'import EmptyState from "../components/ui/EmptyState";\nimport StatCard from "../components/ui/StatCard";'
  );
  console.log("ok: import StatCard");
}

const before = t;
t = t.replace(
  /const StatCard = \(\{ label, value, tone = "default" \}\) => \{[\s\S]*?\n\};\n\n/,
  ""
);
if (t === before) console.warn("no-op: remove local StatCard");
else console.log("ok: remove local StatCard");

const oldFlex = `{/* Summary cards */}
      {summary && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>`;
const newGrid = `{/* Summary cards */}
      {summary && (
        <div className="ec-kpi-grid">`;
if (t.includes(oldFlex)) {
  t = t.replace(oldFlex, newGrid);
  console.log("ok: summary ec-kpi-grid");
} else if (t.includes('className="ec-kpi-grid"')) {
  console.log("no-op: summary grid already");
} else {
  const alt = `{/* Summary cards */}
      {summary && (
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>`;
  if (t.includes(alt)) {
    t = t.replace(alt, newGrid);
    console.log("ok: summary ec-kpi-grid (alt)");
  } else {
    console.warn("WARN: summary flex pattern not found — check manually");
  }
}

const toneMap = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  default: "var(--color-primary)",
};
t = t.replace(/<StatCard([^>]*?)\s*\/>/g, (full, attrs) => {
  if (!attrs.includes("tone=")) return full;
  const fixed = attrs.replace(/\btone="(\w+)"/g, (_, tone) => `color="${toneMap[tone] || toneMap.default}"`);
  return `<StatCard${fixed}/>`;
});
console.log("ok: tone->color on StatCards");

fs.writeFileSync(p, t);
console.log("wrote", rel);
