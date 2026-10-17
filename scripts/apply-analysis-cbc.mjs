#!/usr/bin/env node
import fs from "fs";

// Frontend
{
  const path = "src/pages/AnalysisPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes('calculateCbcSubLevel')) {
    if (!t.includes('../lib/grading')) {
      t = t.replace(
        'import EmptyState from "../components/ui/EmptyState";',
        'import EmptyState from "../components/ui/EmptyState";\nimport { calculateCbcSubLevel, calculateGrade } from "../lib/grading";'
      );
    }
    const oldGi = `const gradeInfo = (score) => {
  if (score >= 80) return { label: "EE", color: "var(--color-success)", bg: "color-mix(in srgb, var(--color-success) 15%, transparent)", text: "Exceeds Expectations" };
  if (score >= 60) return { label: "ME", color: "var(--color-info)", bg: "color-mix(in srgb, var(--color-info) 15%, transparent)", text: "Meets Expectations" };
  if (score >= 40) return { label: "AE", color: "var(--color-warning)", bg: "color-mix(in srgb, var(--color-warning) 15%, transparent)", text: "Approaching Expectations" };
  return              { label: "BE", color: "var(--color-danger)", bg: "color-mix(in srgb, var(--color-danger) 15%, transparent)", text: "Below Expectations" };
};`;
    const newGi = `const gradeInfo = (score) => {
  const parent = calculateGrade(score, "cbc");
  const sub = calculateCbcSubLevel(score);
  const color = sub.color || parent.color || "var(--color-text-muted)";
  return {
    label: sub.grade || parent.grade || "-",
    parent: parent.grade || "-",
    sub_level: sub.grade || "-",
    color,
    bg: "color-mix(in srgb, " + color + " 15%, transparent)",
    text: sub.label || parent.label || "",
  };
};`;
    if (!t.includes(oldGi)) { console.error("gradeInfo block not found"); process.exit(1); }
    t = t.replace(oldGi, newGi);
    t = t.replace(
      '["Mean", `${classStats.overall.mean}%`, "Average score across all students"]',
      '["Class mean", `${classStats.overall.mean}%`, gradeInfo(classStats.overall.mean).sub_level + " · average across learners"]'
    );
    t = t.replace(">Grade Distribution</div>", ">Grade Distribution (CBC EE1–BE2)</div>");
    fs.writeFileSync(path, t);
  }
  console.log("FE ok", fs.readFileSync(path,"utf8").includes("calculateCbcSubLevel"));
}

// Backend class-stats
{
  const path = "backend/src/routes/analysis.routes.js";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("sub_level_distribution")) {
    t = t.replace(
      "if (!bySubj.has(subject)) bySubj.set(subject, { sum: 0, count: 0, grades: [] });",
      "if (!bySubj.has(subject)) bySubj.set(subject, { sum: 0, count: 0, grades: [], subs: [] });"
    );
    const old = `      a.sum += p;\n      a.count += 1;\n      if (r.grade) a.grades.push(r.grade);\n    }`;
    const neu = `      a.sum += p;\n      a.count += 1;\n      const pBand = (v) => {\n        if (v >= 90) return { sub: "EE1", parent: "EE" };\n        if (v >= 80) return { sub: "EE2", parent: "EE" };\n        if (v >= 70) return { sub: "ME1", parent: "ME" };\n        if (v >= 65) return { sub: "ME2", parent: "ME" };\n        if (v >= 55) return { sub: "AE1", parent: "AE" };\n        if (v >= 50) return { sub: "AE2", parent: "AE" };\n        if (v >= 40) return { sub: "BE1", parent: "BE" };\n        return { sub: "BE2", parent: "BE" };\n      };\n      const band = pBand(p);\n      a.grades.push(band.parent);\n      a.subs.push(band.sub);\n    }`;
    if (!t.includes("if (r.grade) a.grades.push(r.grade)")) { console.error("backend loop not found"); process.exit(1); }
    t = t.replace(old, neu);
    t = t.replace(
      `        data.grades.forEach(g => {\n          gradeCounts[g] = (gradeCounts[g] || 0) + 1;\n        });\n        subjectStats[className][subject] = {\n          mean: Number((data.sum / data.count).toFixed(1)),\n          entries: data.count,\n          grade_distribution: gradeCounts,\n        };`,
      `        const subCounts = {};\n        (data.grades || []).forEach(g => { gradeCounts[g] = (gradeCounts[g] || 0) + 1; });\n        (data.subs || []).forEach(g => { subCounts[g] = (subCounts[g] || 0) + 1; });\n        const subMean = Number((data.sum / data.count).toFixed(1));\n        const pBand = (v) => v >= 90 ? "EE1" : v >= 80 ? "EE2" : v >= 70 ? "ME1" : v >= 65 ? "ME2" : v >= 55 ? "AE1" : v >= 50 ? "AE2" : v >= 40 ? "BE1" : "BE2";\n        subjectStats[className][subject] = {\n          mean: subMean,\n          mean_sub_level: pBand(subMean),\n          entries: data.count,\n          grade_distribution: gradeCounts,\n          sub_level_distribution: subCounts,\n        };`
    );
    t = t.replace(
      `    // Grade distribution overall\n    const gradeCounts = {};\n    cleanRows.forEach(r => {\n      if (r.grade) {\n        gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;\n      }\n    });\n\n    res.json({\n      overall: {\n        mean,\n        median,\n        highest,\n        lowest,\n        student_count: studentScores.length,\n        grade_distribution: gradeCounts,\n      },\n      by_class: subjectStats,\n      meta: { term, class_name: className },\n    });`,
      `    const gradeCounts = {};\n    const subLevelCounts = {};\n    const pBandFull = (v) => {\n      if (v >= 90) return { sub: "EE1", parent: "EE" };\n      if (v >= 80) return { sub: "EE2", parent: "EE" };\n      if (v >= 70) return { sub: "ME1", parent: "ME" };\n      if (v >= 65) return { sub: "ME2", parent: "ME" };\n      if (v >= 55) return { sub: "AE1", parent: "AE" };\n      if (v >= 50) return { sub: "AE2", parent: "AE" };\n      if (v >= 40) return { sub: "BE1", parent: "BE" };\n      return { sub: "BE2", parent: "BE" };\n    };\n    cleanRows.forEach(r => {\n      const p = pct(r);\n      if (p == null) return;\n      const b = pBandFull(p);\n      gradeCounts[b.parent] = (gradeCounts[b.parent] || 0) + 1;\n      subLevelCounts[b.sub] = (subLevelCounts[b.sub] || 0) + 1;\n    });\n    const meanSub = mean > 0 ? pBandFull(mean).sub : "-";\n\n    res.json({\n      overall: {\n        mean,\n        mean_sub_level: meanSub,\n        median,\n        highest,\n        lowest,\n        student_count: studentScores.length,\n        grade_distribution: gradeCounts,\n        sub_level_distribution: subLevelCounts,\n      },\n      by_class: subjectStats,\n      meta: { term, class_name: className },\n    });`
    );
    fs.writeFileSync(path, t);
  }
  if (!fs.readFileSync(path,"utf8").includes("sub_level_distribution")) {
    console.error("BE fail");
    process.exit(1);
  }
  console.log("BE ok");
}
console.log("DONE");
