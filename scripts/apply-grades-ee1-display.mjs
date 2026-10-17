#!/usr/bin/env node
import fs from "fs";

{
  const path = "backend/src/routes/grades.routes.js";
  let t = fs.readFileSync(path, "utf8");
  t = t.split("grade: calculatedGrade.level, // Store EE, ME, AE, BE").join(
    "grade: calculatedGrade.grade || calculatedGrade.level, // EE1-BE2"
  );
  t = t.split(".update({ grade: calculatedGrade.level })").join(
    ".update({ grade: calculatedGrade.grade || calculatedGrade.level })"
  );
  t = t.split("grade: calculatedGrade.level,").join(
    "grade: calculatedGrade.grade || calculatedGrade.level,"
  );
  fs.writeFileSync(path, t);
  console.log("grades.routes done");
}

{
  const path = "src/pages/GradesPage.jsx";
  let t = fs.readFileSync(path, "utf8");

  if (!t.includes("calculateCbcSubLevel")) {
    if (t.includes('parseMark } from "../lib/grading"')) {
      t = t.replace('parseMark } from "../lib/grading"', 'parseMark, calculateCbcSubLevel } from "../lib/grading"');
    } else {
      t = t.replace(
        'import { rankingService } from "../services/rankingService";',
        'import { rankingService } from "../services/rankingService";\nimport { calculateCbcSubLevel } from "../lib/grading";'
      );
    }
  }

  if (!t.includes("function displayGrade")) {
    const helpers = `\nfunction displayGrade(result) {\n  const g = String(result?.grade || "").toUpperCase();\n  if (/^(EE|ME|AE|BE)[12]$/.test(g)) return g;\n  const marks = Number(result?.marks);\n  const total = Number(result?.total || result?.total_marks || 100) || 100;\n  if (Number.isFinite(marks) && total > 0) return calculateCbcSubLevel((marks / total) * 100).grade;\n  return g || "-";\n}\nfunction parentOf(code) {\n  const s = String(code || "").toUpperCase();\n  if (s.startsWith("EE")) return "EE";\n  if (s.startsWith("ME")) return "ME";\n  if (s.startsWith("AE")) return "AE";\n  if (s.startsWith("BE")) return "BE";\n  return s;\n}\n`;
    t = t.replace(
      'import { rankingService } from "../services/rankingService";',
      'import { rankingService } from "../services/rankingService";' + helpers
    );
  }

  const countsRe = /const counts = \{\s*EE:\s*results\.filter\(r => r\.grade === "EE"\)\.length,\s*ME:\s*results\.filter\(r => r\.grade === "ME"\)\.length,\s*AE:\s*results\.filter\(r => r\.grade === "AE"\)\.length,\s*BE:\s*results\.filter\(r => r\.grade === "BE"\)\.length,\s*\};/;
  if (countsRe.test(t)) {
    t = t.replace(
      countsRe,
      `const _codes = results.map(displayGrade);\n  const counts = {\n    EE1: _codes.filter(g => g === "EE1").length,\n    EE2: _codes.filter(g => g === "EE2").length,\n    ME1: _codes.filter(g => g === "ME1").length,\n    ME2: _codes.filter(g => g === "ME2").length,\n    AE1: _codes.filter(g => g === "AE1").length,\n    AE2: _codes.filter(g => g === "AE2").length,\n    BE1: _codes.filter(g => g === "BE1").length,\n    BE2: _codes.filter(g => g === "BE2").length,\n  };\n  const SUB_COLORS = { EE1:"#16a34a", EE2:"#22c55e", ME1:"#2563eb", ME2:"#3b82f6", AE1:"#d97706", AE2:"#f59e0b", BE1:"#ef4444", BE2:"#b91c1c" };`
    );
    console.log("counts replaced");
  }

  if (t.includes('["EE","success"]')) {
    t = t.replace(
      /\{\[\["EE","success"\],\["ME","info"\],\["AE","warning"\],\["BE","danger"\]\]\.map\(\[g\]\) => \([\s\S]*?\)\)\}/,
      `{["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].map((g) => (\n           <div key={g} style={{ background:C.card, border:\
`1px solid ${C.border}`\
, borderRadius:10, padding:"10px 14px", minWidth:64, textAlign:"center" }}>\n             <div style={{ fontWeight:800, fontSize:18, color: SUB_COLORS[g] }}>{counts[g]}</div>\n             <div style={{ fontSize:11, color:C.textMuted }}>{g}</div>\n           </div>\n         ))}`
    );
    console.log("kpi done");
  }

  t = t.split("<Badge tone={gradeColor(result.grade)}>{result.grade}</Badge>").join(
    "<Badge tone={gradeColor(parentOf(displayGrade(result)))}>{displayGrade(result)}</Badge>"
  );

  fs.writeFileSync(path, t);
  console.log("GradesPage", t.includes("displayGrade"));
}

{
  const path = "src/pages/AnalysisPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("Sub-levels (EE1")) {
    const start = t.indexOf("              {/* Grade Distribution */}");
    const end = t.indexOf("              {/* Subject Breakdown by Class */}");
    if (start >= 0 && end > start) {
      const block = `              {/* Grade Distribution — parent + EE1–BE2 */}\n              {(Object.keys(classStats.overall.grade_distribution || {}).length > 0 ||\n                Object.keys(classStats.overall.sub_level_distribution || {}).length > 0) && (\n                <div style={{ marginBottom: "var(--space-4)" }}>\n                  <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-2)", fontSize: "15px" }}>\n                    Grade Distribution\n                    {classStats.overall.mean_sub_level ? (\n                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-secondary)", marginLeft: 8 }}>\n                        Class mean: {classStats.overall.mean}% · {classStats.overall.mean_sub_level}\n                      </span>\n                    ) : null}\n                  </div>\n                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>Parent bands</div>\n                  <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: 12 }}>\n                    {Object.entries(classStats.overall.grade_distribution || {}).map(([grade, count]) => {\n                      const sample = grade === "EE" ? 85 : grade === "ME" ? 70 : grade === "AE" ? 55 : 30;\n                      const g = gradeInfo(sample);\n                      return (\n                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: "var(--radius-md)", padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>\n                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />\n                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>\n                        </div>\n                      );\n                    })}\n                  </div>\n                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>Sub-levels (EE1 – BE2)</div>\n                  <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>\n                    {["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].filter((k) => (classStats.overall.sub_level_distribution || {})[k]).map((grade) => {\n                      const count = classStats.overall.sub_level_distribution[grade];\n                      const sample = grade === "EE1" ? 95 : grade === "EE2" ? 85 : grade === "ME1" ? 75 : grade === "ME2" ? 67 : grade === "AE1" ? 58 : grade === "AE2" ? 52 : grade === "BE1" ? 45 : 25;\n                      const g = gradeInfo(sample);\n                      return (\n                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: "var(--radius-md)", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px" }}>\n                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />\n                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>\n                        </div>\n                      );\n                    })}\n                  </div>\n                </div>\n              )}\n\n`;
      t = t.slice(0, start) + block + t.slice(end);
      console.log("Analysis distribution replaced");
    }
  }
  fs.writeFileSync(path, t);
  console.log("AnalysisPage", t.includes("Sub-levels (EE1"));
}

console.log("ALL DONE");
