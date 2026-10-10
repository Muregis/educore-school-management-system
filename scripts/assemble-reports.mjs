#!/usr/bin/env node
/** Assemble ReportsPage.jsx from part files under scripts/reports-parts/ */
import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "scripts/reports-parts");
const out = path.join(process.cwd(), "src/pages/ReportsPage.jsx");
const parts = [0, 1, 2, 3].map((i) => {
  const p = path.join(dir, `part${i}.txt`);
  if (!fs.existsSync(p)) throw new Error("missing " + p);
  return fs.readFileSync(p, "utf8");
});
const content = parts.join("");
if (!content.includes("ec-kpi-grid") || content.includes("PLACEHOLDER")) {
  throw new Error("assembled content failed validation");
}
fs.writeFileSync(out, content);
console.log("wrote", out, content.length, "bytes");
