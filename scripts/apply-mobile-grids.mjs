#!/usr/bin/env node
/**
 * Convert inline KPI/content grids to shared classes (no feature deletion).
 * - KPI tracks (≤200px minmax) → className="ec-kpi-grid" (2-col on phones)
 * - Large content grids (≥300px minmax) → className="ec-stack-grid" (1-col on phones)
 */
import fs from "fs";
import path from "path";

const pagesDir = "src/pages";
const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith(".jsx"));

const kpiRe =
  /style=\{\{\s*display:\s*["']grid["'],\s*gridTemplateColumns:\s*["']repeat\(auto-(?:fit|fill),\s*minmax\(min\(100%,\s*\d+px\),\s*1fr\)\)["']\s*(?:,\s*gap:\s*[^,}]+)?(?:,\s*marginBottom:\s*[^,}]+)?\s*\}\}/g;
const kpiRe2 =
  /style=\{\{\s*display:\s*["']grid["'],\s*gridTemplateColumns:\s*["']repeat\(auto-(?:fit|fill),\s*minmax\((?:1[0-9]{2}|200)px,\s*1fr\)\)["']\s*(?:,\s*gap:\s*[^,}]+)?(?:,\s*marginBottom:\s*[^,}]+)?\s*\}\}/g;
const contentRe =
  /style=\{\{\s*display:\s*["']grid["'],\s*gridTemplateColumns:\s*["']repeat\(auto-(?:fit|fill),\s*minmax\((?:3\d{2}|4\d{2})px,\s*1fr\)\)["']\s*(?:,\s*gap:\s*[^,}]+)?(?:,\s*alignItems:\s*[^,}]+)?\s*\}\}/g;

function replaceKpi(match) {
  const mb = match.match(/marginBottom:\s*([^,}]+)/);
  if (mb) return `className="ec-kpi-grid" style={{ marginBottom: ${mb[1].trim()} }}`;
  return `className="ec-kpi-grid"`;
}

let changed = 0;
for (const file of files) {
  const fp = path.join(pagesDir, file);
  let t = fs.readFileSync(fp, "utf8");
  const before = t;
  t = t.replace(kpiRe, replaceKpi);
  t = t.replace(kpiRe2, replaceKpi);
  t = t.replace(contentRe, (match) => {
    const gap = match.match(/gap:\s*([^,}]+)/);
    const align = match.match(/alignItems:\s*([^,}]+)/);
    const parts = [];
    if (gap) parts.push(`gap: ${gap[1].trim()}`);
    if (align) parts.push(`alignItems: ${align[1].trim()}`);
    return parts.length
      ? `className="ec-stack-grid" style={{ ${parts.join(", ")} }}`
      : `className="ec-stack-grid"`;
  });
  if (t !== before) {
    fs.writeFileSync(fp, t);
    changed++;
    console.log("patched", file);
  }
}
console.log("files changed:", changed);
