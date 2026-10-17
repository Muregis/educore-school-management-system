#!/usr/bin/env node
/** Surgical apply: grades store EE1; GradesPage + AnalysisPage show EE1–BE2 */
import fs from "fs";

// grades.routes — store sub-level code
{
  const path = "backend/src/routes/grades.routes.js";
  let t = fs.readFileSync(path, "utf8");
  t = t.replace(/grade:\s*calculatedGrade\.level\s*,\s*\/\/ Store EE, ME, AE, BE/g,
    "grade: calculatedGrade.grade || calculatedGrade.level, // EE1–BE2");
  t = t.replace(/\.update\(\{\s*grade:\s*calculatedGrade\.level\s*\}\)/g,
    ".update({ grade: calculatedGrade.grade || calculatedGrade.level })");
  t = t.replace(/grade:\s*calculatedGrade\.level,/g,
    "grade: calculatedGrade.grade || calculatedGrade.level,");
  fs.writeFileSync(path, t);
  console.log("grades.routes ok");
}

// GradesPage
{
  const path = "src/pages/GradesPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("calculateCbcSubLevel")) {
    t = t.replace(
      'import { getGradeColor as getGradeHexColor, parseMark } from "../lib/grading";',
      'import { getGradeColor as getGradeHexColor, parseMark, calculateCbcSubLevel } from "../lib/grading";'
    );
  }
  if (!t.includes("function displayGrade")) {
    t = t.replace(
      'import { rankingService } from "../services/rankingService";',
      `import { rankingService } from "../services/rankingService";

function displayGrade(result) {
  const g = String(result?.grade || "").toUpperCase();
  if (/^(EE|ME|AE|BE)[12]$/.test(g)) return g;
  const marks = Number(result?.marks);
  const total = Number(result?.total || result?.total_marks || 100) || 100;
  if (Number.isFinite(marks) && total > 0) return calculateCbcSubLevel((marks / total) * 100).grade;
  return g || "-";
}
function parentOf(code) {
  const s = String(code || "").toUpperCase();
  if (s.startsWith("EE")) return "EE";
  if (s.startsWith("ME")) return "ME";
  if (s.startsWith("AE")) return "AE";
  if (s.startsWith("BE")) return "BE";
  return s;
}
`
    );
  }
  // counts KPI
  if (t.includes('r.grade === "EE"') && !t.includes('EE1:')) {
    t = t.replace(
      /const counts = \{[\s\S]*?BE:\s*results\.filter\([^)]+\)\.length,\s*\};/,
      `const _codes = results.map(displayGrade);
  const counts = {
    EE1: _codes.filter(g => g === "EE1").length,
    EE2: _codes.filter(g => g === "EE2").length,
    ME1: _codes.filter(g => g === "ME1").length,
    ME2: _codes.filter(g => g === "ME2").length,
    AE1: _codes.filter(g => g === "AE1").length,
    AE2: _codes.filter(g => g === "AE2").length,
    BE1: _codes.filter(g => g === "BE1").length,
    BE2: _codes.filter(g => g === "BE2").length,
  };
  const SUB_COLORS = { EE1:"#16a34a",EE2:"#22c55e",ME1:"#2563eb",ME2:"#3b82f6",AE1:"#d97706",AE2:"#f59e0b",BE1:"#ef4444",BE2:"#b91c1c" };`
    );
  }
  if (t.includes('["EE","success"]') && !t.includes('["EE1","EE2"')) {
    t = t.replace(
      /\{\[\["EE","success"\],\["ME","info"\],\["AE","warning"\],\["BE","danger"\]\]\.map\(\[g\]\) => \([\s\S]*?\)\)\}/,
      `{["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].map((g) => (
           <div key={g} style={{ background:C.card, border:\
`1px solid ${C.border}`\
, borderRadius:10, padding:"10px 14px", minWidth:64, textAlign:"center" }}>
             <div style={{ fontWeight:800, fontSize:18, color: SUB_COLORS[g] }}>{counts[g]}</div>
             <div style={{ fontSize:11, color:C.textMuted }}>{g}</div>
           </div>
         ))}`
    );
  }
  t = t.replace(
    /<Badge tone=\{gradeColor\(result\.grade\)\}>\{result\.grade\}<\/Badge>/g,
    "<Badge tone={gradeColor(parentOf(displayGrade(result)))}>{displayGrade(result)}</Badge>"
  );
  fs.writeFileSync(path, t);
  console.log("GradesPage ok", t.includes("displayGrade"));
}

// AnalysisPage — sub-level strip
{
  const path = "src/pages/AnalysisPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("Sub-levels (EE1")) {
    const start = t.indexOf("              {/* Grade Distribution */}");
    const end = t.indexOf("              {/* Subject Breakdown by Class */}");
    if (start >= 0 && end > start) {
      const block = `              {/* Grade Distribution — parent + EE1–BE2 */}
              {(Object.keys(classStats.overall.grade_distribution || {}).length > 0 ||
                Object.keys(classStats.overall.sub_level_distribution || {}).length > 0) && (
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-2)", fontSize: "15px" }}>
                    Grade Distribution
                    {classStats.overall.mean_sub_level ? (
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-secondary)", marginLeft: 8 }}>
                        Class mean: {classStats.overall.mean}% · {classStats.overall.mean_sub_level}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>Parent bands</div>
                  <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: 12 }}>
                    {Object.entries(classStats.overall.grade_distribution || {}).map(([grade, count]) => {
                      const sample = grade === "EE" ? 85 : grade === "ME" ? 70 : grade === "AE" ? 55 : 30;
                      const g = gradeInfo(sample);
                      return (
                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: "var(--radius-md)", padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />
                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>Sub-levels (EE1 – BE2)</div>
                  <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    {["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].filter((k) => (classStats.overall.sub_level_distribution || {})[k]).map((grade) => {
                      const count = classStats.overall.sub_level_distribution[grade];
                      const sample = grade === "EE1" ? 95 : grade === "EE2" ? 85 : grade === "ME1" ? 75 : grade === "ME2" ? 67 : grade === "AE1" ? 58 : grade === "AE2" ? 52 : grade === "BE1" ? 45 : 25;
                      const g = gradeInfo(sample);
                      return (
                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: "var(--radius-md)", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />
                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

`;
      t = t.slice(0, start) + block + t.slice(end);
    }
  }
  fs.writeFileSync(path, t);
  console.log("AnalysisPage ok", t.includes("Sub-levels (EE1"));
}

console.log("DONE");
