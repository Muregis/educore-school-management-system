#!/usr/bin/env node
import fs from "fs";
const cssPath = "src/styles/layout-foundation.css";
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes("ANALYSIS PAGE MOBILE") && fs.existsSync("scripts/analysis-mobile.css.snippet")) {
  fs.writeFileSync(cssPath, css.trimEnd() + "\n\n" + fs.readFileSync("scripts/analysis-mobile.css.snippet", "utf8"));
  console.log("css");
}
const path = "src/pages/AnalysisPage.jsx";
let t = fs.readFileSync(path, "utf8");
if (!t.includes('className="analysis-page"')) {
  t = t.replace(
    `  return (\n    <div>\n      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>\n        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>Academic Analysis</h1>\n      </div>`,
    `  return (\n    <div className="analysis-page">\n      <div className="analysis-page-header">\n        <h1>Academic Analysis</h1>\n      </div>`
  );
}
t = t.replaceAll(`style={{ width: "150px" }}`, `className="analysis-filter-field"`);
t = t.replaceAll(`width: 120, fontSize: "13px"`, `flex: "1 1 100%", minWidth: 0, fontSize: "13px"`);
t = t.replaceAll(`width: 40, fontWeight: 700`, `flexShrink: 0, fontWeight: 700`);
t = t.replaceAll(`width: 30, textAlign: "center"`, `flexShrink: 0, textAlign: "center"`);
t = t.replace(
  `<div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>\n                <Table \n                  headers={["Position", "Student", "Admission No.", "Class", "Average", "Total Marks", "Subjects"]}`,
  `<div className="analysis-rank-table-wrap">\n                <Table \n                  headers={["Position", "Student", "Admission No.", "Class", "Average", "Total Marks", "Subjects"]}`
);
fs.writeFileSync(path, t);
console.log("ok", t.includes("analysis-page"), t.includes("width: 120"));
