#!/usr/bin/env node
import fs from "fs";

const path = "src/styles/layout-foundation.css";
let t = fs.readFileSync(path, "utf8");

const nuclearKpi = `/* KPI summary grids — phones ALWAYS 2 columns (never 7 skinny pills) */
.ec-kpi-grid {
  display: grid !important;
  gap: 10px !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  align-items: stretch;
}
.ec-kpi-grid > * {
  min-width: 0 !important;
  max-width: 100% !important;
  width: auto !important;
  flex: none !important;
}
@media screen and (min-width: 640px) {
  .ec-kpi-grid {
    gap: var(--space-3) !important;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) !important;
  }
}
@media screen and (min-width: 1024px) {
  .ec-kpi-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
  }
}
`;

const stackGrid = `/* Content grids (charts, dual panels) — 1 col on phone, multi from tablet */
.ec-stack-grid {
  display: grid !important;
  gap: var(--space-4);
  grid-template-columns: 1fr !important;
  width: 100%;
  min-width: 0;
}
@media screen and (min-width: 768px) {
  .ec-stack-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)) !important;
  }
}
`;

// Replace old KPI block if present
const oldKpiPatterns = [
  /\/\* KPI summary grids[\s\S]*?@media screen and \(max-width: 420px\) \{[\s\S]*?\}\n/,
  /\/\* KPI summary grids[\s\S]*?@media screen and \(min-width: 1024px\) \{[\s\S]*?\}\n/,
];

let replaced = false;
for (const re of oldKpiPatterns) {
  if (re.test(t)) {
    t = t.replace(re, nuclearKpi);
    replaced = true;
    console.log("replaced KPI block");
    break;
  }
}

if (!t.includes("repeat(2, minmax(0, 1fr)) !important")) {
  // append nuclear if missing
  t += "\n" + nuclearKpi;
  console.log("appended nuclear KPI");
}

if (!t.includes(".ec-stack-grid")) {
  t += "\n" + stackGrid;
  console.log("appended stack-grid");
}

fs.writeFileSync(path, t);
console.log("CSS OK");
