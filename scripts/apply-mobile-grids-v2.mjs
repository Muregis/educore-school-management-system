#!/usr/bin/env node
/**
 * Convert ALL inline auto-fit/fill grids on pages to shared mobile classes.
 * ≤240px track → ec-kpi-grid (2-col phones)
 * ≥260px track → ec-stack-grid (1-col phones)
 */
import fs from "fs";
import path from "path";

const pagesDir = "src/pages";
const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith(".jsx"));
let changedFiles = 0;

for (const file of files) {
  const fp = path.join(pagesDir, file);
  let t = fs.readFileSync(fp, "utf8");
  const before = t;

  t = t.replace(
    /style=\{\{([^}]*gridTemplateColumns:\s*["']repeat\(auto-(?:fit|fill),\s*minmax\([^"']+\)["'][^}]*)\}\}/g,
    (full, inner) => {
      const mm = inner.match(/minmax\((?:min\(100%,\s*)?(\d+)px/);
      if (!mm) return full;
      const px = parseInt(mm[1], 10);
      const mb = inner.match(/marginBottom:\s*([^,}]+)/);
      const gap = inner.match(/gap:\s*([^,}]+)/);
      const align = inner.match(/alignItems:\s*([^,}]+)/);
      if (px <= 240) {
        if (mb) return `className="ec-kpi-grid" style={{ marginBottom: ${mb[1].trim()} }}`;
        return `className="ec-kpi-grid"`;
      }
      if (px >= 260) {
        const parts = [];
        if (gap) parts.push(`gap: ${gap[1].trim()}`);
        if (align) parts.push(`alignItems: ${align[1].trim()}`);
        if (mb) parts.push(`marginBottom: ${mb[1].trim()}`);
        return parts.length
          ? `className="ec-stack-grid" style={{ ${parts.join(", ")} }}`
          : `className="ec-stack-grid"`;
      }
      return full;
    }
  );

  t = t.replace(
    /style=\{\{\s*display:\s*["']grid["'],\s*\n\s*gridTemplateColumns:\s*["']repeat\(auto-(?:fit|fill),\s*minmax\((?:min\(100%,\s*)?(\d+)px,\s*1fr\)\)["'],\s*\n\s*gap:\s*([^,\n}]+)(?:,\s*\n\s*marginBottom:\s*([^,\n}]+))?(?:,\s*\n\s*alignItems:\s*([^,\n}]+))?\s*\n?\s*\}\}/g,
    (full, pxStr, gap, mb, align) => {
      const px = parseInt(pxStr, 10);
      if (px <= 240) {
        return mb
          ? `className="ec-kpi-grid" style={{ marginBottom: ${mb.trim()} }}`
          : `className="ec-kpi-grid"`;
      }
      if (px >= 260) {
        const parts = [`gap: ${gap.trim()}`];
        if (align) parts.push(`alignItems: ${align.trim()}`);
        if (mb) parts.push(`marginBottom: ${mb.trim()}`);
        return `className="ec-stack-grid" style={{ ${parts.join(", ")} }}`;
      }
      return full;
    }
  );

  if (t !== before) {
    fs.writeFileSync(fp, t);
    changedFiles++;
    console.log("patched", file);
  }
}
console.log("files changed:", changedFiles);
