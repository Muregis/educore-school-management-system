#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = process.cwd();
const parts = [0, 1, 2].map((i) =>
  fs.readFileSync(path.join(root, `scripts/merit-part${i}.b64`), "utf8").replace(/\s+/g, "")
);
const buf = Buffer.from(parts.join(""), "base64");
fs.writeFileSync(path.join(root, "src/pages/MeritListPage.jsx"), buf);
console.log("MeritListPage", buf.length);

const rp = path.join(root, "src/pages/ReportsPage.jsx");
let t = fs.readFileSync(rp, "utf8");
if (!t.includes("calculateCbcSubLevel")) {
  t = t.replace(
    'import { calculateGrade } from "../lib/grading";',
    'import { calculateGrade, calculateCbcSubLevel } from "../lib/grading";'
  );
}
const oldGi = `const gradeInfo = (score) => {\n  const grade = calculateGrade(score, 'CBC');\n  return {\n    label: grade.grade,\n    color: grade.color,\n    bg: grade.bgColor,\n    text: grade.label\n  };\n};`;
const newGi = `const gradeInfo = (score) => {\n  const sub = calculateCbcSubLevel(score);\n  if (sub?.grade) {\n    return { label: sub.grade, color: sub.color || "#3b82f6", bg: (sub.color || "#3b82f6") + "22", text: sub.label || sub.grade };\n  }\n  const grade = calculateGrade(score, "cbc");\n  return { label: grade.grade, color: grade.color, bg: grade.bgColor || ((grade.color || "#9ca3af") + "22"), text: grade.label };\n};`;
if (t.includes(oldGi)) t = t.replace(oldGi, newGi);
if (!t.includes("ec-reports-print")) {
  t = t.replace(
    '    <div style={{ display: "grid", gap: "var(--space-4)" }}>',
    '    <div className="ec-reports-page ec-reports-print" style={{ display: "grid", gap: "var(--space-4)", maxWidth: "100%", overflowX: "hidden" }}>',
    1
  );
}
if (t.includes("<Button onClick={load}>") && !t.includes("window.print()")) {
  t = t.replace(
    `<Button onClick={load}>\n              Refresh\n            </Button>`,
    `<Button onClick={load}>Refresh</Button>\n            <Button variant="secondary" onClick={() => window.print()}>Print</Button>`
  );
}
fs.writeFileSync(rp, t);
console.log("ReportsPage ok", t.includes("calculateCbcSubLevel"));
