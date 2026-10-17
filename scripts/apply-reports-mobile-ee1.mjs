#!/usr/bin/env node
import fs from "fs";

// ── ReportsPage ──
{
  const path = "src/pages/ReportsPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("calculateCbcSubLevel")) {
    t = t.replace(
      'import { calculateGrade } from "../lib/grading";',
      'import { calculateGrade, calculateCbcSubLevel } from "../lib/grading";'
    );
  }
  const oldGi = `const gradeInfo = (score) => {
  const grade = calculateGrade(score, 'CBC');
  return {
    label: grade.grade,
    color: grade.color,
    bg: grade.bgColor,
    text: grade.label
  };
};`;
  const newGi = `const gradeInfo = (score) => {
  const sub = calculateCbcSubLevel(score);
  if (sub?.grade) {
    return {
      label: sub.grade,
      color: sub.color || "#3b82f6",
      bg: (sub.color || "#3b82f6") + "22",
      text: sub.label || sub.grade,
    };
  }
  const grade = calculateGrade(score, "cbc");
  return {
    label: grade.grade,
    color: grade.color,
    bg: grade.bgColor || ((grade.color || "#9ca3af") + "22"),
    text: grade.label,
  };
};`;
  if (t.includes(oldGi)) t = t.replace(oldGi, newGi);
  if (!t.includes("ec-reports-page")) {
    t = t.replace(
      '<div style={{ display: "grid", gap: "var(--space-4)" }}>',
      '<div className="ec-reports-page" style={{ display: "grid", gap: "var(--space-4)", maxWidth: "100%", overflowX: "hidden" }}>'
    );
  }
  t = t.split('whiteSpace: "nowrap", width: "230px", flexShrink: 0').join(
    'whiteSpace: "normal", minWidth: 0, flex: "1 1 140px", maxWidth: "100%"'
  );
  t = t.split(
    'width: 120, fontSize: "13px", color: "var(--color-text-primary)", fontWeight: 500'
  ).join(
    'flex: "0 1 100px", minWidth: 0, fontSize: "12px", color: "var(--color-text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis"'
  );
  t = t.replace(
    '{[["visual","📊 Visual Report"],["ai","🤖 AI Report"]].map(([mode, label]) => (',
    '{[["visual","Visual"],["ai","AI"]].map(([mode, label]) => ('
  );
  fs.writeFileSync(path, t);
  console.log("ReportsPage", t.includes("calculateCbcSubLevel"), t.includes("ec-reports-page"));
}

// ── GradesPage KPI EE1–BE2 ──
{
  const path = "src/pages/GradesPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  const oldColor = `function gradeColor(grade) {
  // Map grades to Badge tones - uses shared utility logic
  if (!grade) return "info";
  if (grade === "EE") return "success";
  if (grade === "ME") return "info";
  if (grade === "AE") return "warning";
  return "danger";
}`;
  const newColor = `function gradeColor(grade) {
  if (!grade) return "info";
  const g = String(grade).toUpperCase();
  if (g.startsWith("EE")) return "success";
  if (g.startsWith("ME")) return "info";
  if (g.startsWith("AE")) return "warning";
  return "danger";
}`;
  if (t.includes(oldColor)) t = t.replace(oldColor, newColor);
  else if (!t.includes('g.startsWith("EE")')) {
    t = t.replace(
      /function gradeColor\(grade\) \{[\s\S]*?\n\}/,
      newColor
    );
  }
  const oldCounts = `  const counts = {
    EE: results.filter(r => r.grade === "EE").length,
    ME: results.filter(r => r.grade === "ME").length,
    AE: results.filter(r => r.grade === "AE").length,
    BE: results.filter(r => r.grade === "BE").length,
  };`;
  const newCounts = `  const counts = {
    EE1: results.filter(r => String(r.grade).toUpperCase() === "EE1").length,
    EE2: results.filter(r => String(r.grade).toUpperCase() === "EE2").length,
    ME1: results.filter(r => String(r.grade).toUpperCase() === "ME1").length,
    ME2: results.filter(r => String(r.grade).toUpperCase() === "ME2").length,
    AE1: results.filter(r => String(r.grade).toUpperCase() === "AE1").length,
    AE2: results.filter(r => String(r.grade).toUpperCase() === "AE2").length,
    BE1: results.filter(r => String(r.grade).toUpperCase() === "BE1").length,
    BE2: results.filter(r => String(r.grade).toUpperCase() === "BE2").length,
  };
  counts.EE = counts.EE1 + counts.EE2 + results.filter(r => String(r.grade).toUpperCase() === "EE").length;
  counts.ME = counts.ME1 + counts.ME2 + results.filter(r => String(r.grade).toUpperCase() === "ME").length;
  counts.AE = counts.AE1 + counts.AE2 + results.filter(r => String(r.grade).toUpperCase() === "AE").length;
  counts.BE = counts.BE1 + counts.BE2 + results.filter(r => String(r.grade).toUpperCase() === "BE").length;
  const SUB_COLORS = { EE1:"#16a34a", EE2:"#22c55e", ME1:"#2563eb", ME2:"#3b82f6", AE1:"#d97706", AE2:"#f59e0b", BE1:"#ef4444", BE2:"#b91c1c" };`;
  if (t.includes(oldCounts)) t = t.replace(oldCounts, newCounts);
  const oldKpi = `         {[["EE","success"],["ME","info"],["AE","warning"],["BE","danger"]].map(([g]) => (
           <div key={g} style={{ background:C.card, border:\`1px solid \${C.border}\`, borderRadius:10, padding:"10px 16px", minWidth:70, textAlign:"center" }}>
             <div style={{ fontWeight:800, fontSize:20, color: g==="EE"?"#22c55e":g==="ME"?"#38bdf8":g==="AE"?"#f59e0b":"#ef4444" }}>{counts[g]}</div>
             <div style={{ fontSize:11, color:C.textMuted }}>{g}</div>
           </div>
         ))}`;
  // line-based KPI replace
  if (t.includes('["EE","success"]')) {
    const lines = t.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].includes('["EE","success"]')) {
        out.push('         {["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].map((g) => (');
        out.push('           <div key={g} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 12px", minWidth:56, textAlign:"center" }}>');
        out.push("             <div style={{ fontWeight:800, fontSize:16, color: SUB_COLORS[g] }}>{counts[g]}</div>");
        out.push("             <div style={{ fontSize:10, color:C.textMuted }}>{g}</div>");
        out.push("           </div>");
        out.push("         ))}");
        while (i < lines.length && !lines[i].includes("))}")) i++;
        i++;
        continue;
      }
      out.push(lines[i]);
      i++;
    }
    t = out.join("\n");
  }
  fs.writeFileSync(path, t);
  console.log("GradesPage", t.includes("EE1"), t.includes("SUB_COLORS"));
}

// CSS
{
  const path = "src/styles/layout-foundation.css";
  if (fs.existsSync(path)) {
    let css = fs.readFileSync(path, "utf8");
    if (!css.includes("ec-reports-page")) {
      css += `\n/* Reports page mobile */\n.ec-reports-page { max-width: 100%; overflow-x: hidden; }\n.ec-reports-page .ec-stack-grid { min-width: 0; }\n@media (max-width: 640px) {\n  .ec-reports-page h1, .ec-reports-page h2, .ec-reports-page h3 { font-size: 1.05rem !important; line-height: 1.3; }\n  .ec-reports-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; }\n}\n`;
      fs.writeFileSync(path, css);
    }
    console.log("css ok");
  }
}
console.log("DONE");
