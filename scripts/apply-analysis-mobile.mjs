#!/usr/bin/env node
import fs from "fs";
const cssPath = "src/styles/layout-foundation.css";
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes("ANALYSIS PAGE MOBILE")) {
  const snippet = fs.readFileSync("scripts/analysis-mobile.css.snippet", "utf8");
  fs.writeFileSync(cssPath, css.trimEnd() + "\n\n" + snippet);
  console.log("css appended");
} else console.log("css already present");

const parts = fs.readdirSync("scripts")
  .filter(f => f.startsWith("analysispage-chunk") && f.endsWith(".txt"))
  .sort((a,b) => Number(a.replace(/\D/g,"")) - Number(b.replace(/\D/g,"")));
if (!parts.length) {
  console.error("missing analysispage-chunk files");
  process.exit(1);
}
const b64 = parts.map(f => fs.readFileSync("scripts/"+f,"utf8").trim()).join("");
fs.writeFileSync("src/pages/AnalysisPage.jsx", Buffer.from(b64, "base64"));
const t = fs.readFileSync("src/pages/AnalysisPage.jsx","utf8");
if (!t.includes("analysis-rank-cards") || !t.includes("analysis-page")) {
  console.error("assembled page missing mobile classes");
  process.exit(1);
}
console.log("AnalysisPage ok", t.length);
