#!/usr/bin/env node
import fs from "fs";
import { execSync } from "child_process";

// 1) grades.routes — store EE1–BE2
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
  if (!t.includes("calculatedGrade.grade")) {
    console.error("FAIL grades.routes");
    process.exit(1);
  }
  console.log("grades.routes ok");
}

// 2) knecGrading — CBC EE1–BE2
{
  const path = "backend/src/utils/knecGrading.js";
  fs.writeFileSync(
    path,
    `/**
 * CBC: EE 80+ | ME 65-79 | AE 50-64 | BE <50 — sub-levels EE1..BE2
 */
export function knecGrade(percentage) {
  const p = Number(percentage);
  const pct = Number.isFinite(p) ? p : 0;
  if (pct >= 90) return { grade: "EE1", level: "EE", label: "Exceeds Expectations (1)" };
  if (pct >= 80) return { grade: "EE2", level: "EE", label: "Exceeds Expectations (2)" };
  if (pct >= 70) return { grade: "ME1", level: "ME", label: "Meets Expectations (1)" };
  if (pct >= 65) return { grade: "ME2", level: "ME", label: "Meets Expectations (2)" };
  if (pct >= 55) return { grade: "AE1", level: "AE", label: "Approaches Expectations (1)" };
  if (pct >= 50) return { grade: "AE2", level: "AE", label: "Approaches Expectations (2)" };
  if (pct >= 40) return { grade: "BE1", level: "BE", label: "Below Expectations (1)" };
  return { grade: "BE2", level: "BE", label: "Below Expectations (2)" };
}

export function classRanking(students = [], totalSubjects = null) {
  const scored = students.map((s) => {
    const subjectScores = (s.subjects || []).map((r) => {
      const pct = r.total_marks > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;
      return { subject: r.subject, marks: r.marks, total_marks: r.total_marks, percentage: +pct.toFixed(1), ...knecGrade(pct) };
    });
    const n = totalSubjects || subjectScores.length;
    const mean = subjectScores.length ? subjectScores.reduce((a, b) => a + b.percentage, 0) / n : 0;
    return {
      student_id: s.student_id, name: s.name, admission_number: s.admission_number || "",
      class_name: s.class_name || "", subjectScores, mean: +mean.toFixed(1),
      subjectsTaken: subjectScores.length, overall: knecGrade(mean),
    };
  });
  scored.sort((a, b) => b.mean - a.mean || String(a.name).localeCompare(String(b.name)));
  let rank = 1, prev = null;
  return scored.map((s, idx) => {
    if (prev !== null && s.mean < prev - 0.001) rank = idx + 1;
    prev = s.mean;
    return { ...s, position: rank };
  });
}

export default { knecGrade, classRanking };
`
  );
  console.log("knecGrading ok");
}

// 3) GradesPage
{
  const path = "src/pages/GradesPage.jsx";
  let t = fs.readFileSync(path, "utf8");

  if (!t.includes("calculateCbcSubLevel")) {
    t = t.replace(
      'parseMark } from "../lib/grading"',
      'parseMark, calculateCbcSubLevel } from "../lib/grading"'
    );
  }

  if (!t.includes("function displayGrade")) {
    const helpers =
      "\nfunction displayGrade(result) {\n" +
      '  const g = String(result?.grade || "").toUpperCase();\n' +
      "  if (/^(EE|ME|AE|BE)[12]$/.test(g)) return g;\n" +
      "  const marks = Number(result?.marks);\n" +
      "  const total = Number(result?.total || result?.total_marks || 100) || 100;\n" +
      "  if (Number.isFinite(marks) && total > 0) return calculateCbcSubLevel((marks / total) * 100).grade;\n" +
      '  return g || "-";\n}\n' +
      "function parentOf(code) {\n" +
      '  const s = String(code || "").toUpperCase();\n' +
      '  if (s.startsWith("EE")) return "EE";\n' +
      '  if (s.startsWith("ME")) return "ME";\n' +
      '  if (s.startsWith("AE")) return "AE";\n' +
      '  if (s.startsWith("BE")) return "BE";\n' +
      "  return s;\n}\n";
    t = t.replace(
      'import { rankingService } from "../services/rankingService";',
      'import { rankingService } from "../services/rankingService";' + helpers
    );
  }

  const countsOld =
    "  const counts = {\n" +
    '    EE: results.filter(r => r.grade === "EE").length,\n' +
    '    ME: results.filter(r => r.grade === "ME").length,\n' +
    '    AE: results.filter(r => r.grade === "AE").length,\n' +
    '    BE: results.filter(r => r.grade === "BE").length,\n' +
    "  };";
  const countsNew =
    "  const _codes = results.map(displayGrade);\n" +
    "  const counts = {\n" +
    '    EE1: _codes.filter(g => g === "EE1").length,\n' +
    '    EE2: _codes.filter(g => g === "EE2").length,\n' +
    '    ME1: _codes.filter(g => g === "ME1").length,\n' +
    '    ME2: _codes.filter(g => g === "ME2").length,\n' +
    '    AE1: _codes.filter(g => g === "AE1").length,\n' +
    '    AE2: _codes.filter(g => g === "AE2").length,\n' +
    '    BE1: _codes.filter(g => g === "BE1").length,\n' +
    '    BE2: _codes.filter(g => g === "BE2").length,\n' +
    "  };\n" +
    '  const SUB_COLORS = { EE1:"#16a34a", EE2:"#22c55e", ME1:"#2563eb", ME2:"#3b82f6", AE1:"#d97706", AE2:"#f59e0b", BE1:"#ef4444", BE2:"#b91c1c" };';
  if (t.includes(countsOld)) {
    t = t.split(countsOld).join(countsNew);
    console.log("counts ok");
  }

  if (t.includes('["EE","success"]')) {
    const lines = t.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].includes('["EE","success"]')) {
        out.push('{["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].map((g) => (');
        out.push('           <div key={g} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", minWidth:64, textAlign:"center" }}>');
        out.push("             <div style={{ fontWeight:800, fontSize:18, color: SUB_COLORS[g] }}>{counts[g]}</div>");
        out.push("             <div style={{ fontSize:11, color:C.textMuted }}>{g}</div>");
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
    console.log("kpi", !t.includes('["EE","success"]'));
  }

  t = t.split("<Badge tone={gradeColor(result.grade)}>{result.grade}</Badge>").join(
    "<Badge tone={gradeColor(parentOf(displayGrade(result)))}>{displayGrade(result)}</Badge>"
  );

  fs.writeFileSync(path, t);
  console.log("GradesPage", t.includes("displayGrade"), t.includes("EE1"));
}

execSync("node --check backend/src/utils/knecGrading.js", { stdio: "inherit" });
execSync("node --check backend/src/routes/grades.routes.js", { stdio: "inherit" });
console.log("DONE");
