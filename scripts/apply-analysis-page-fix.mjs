#!/usr/bin/env node
import fs from "fs";

{
  let t = fs.readFileSync("backend/src/routes/analysis.routes.js", "utf8");
  t = t.replaceAll(
    "stream_label: `${c.class_name} ${c.section}`,",
    'stream_label: (c.section ? `${c.class_name} ${String(c.section).trim()}` : String(c.class_name || "")),'
  );
  t = t.replaceAll(
    "const streamLabel = `${c.class_name} ${c.section}`;",
    'const streamLabel = c.section ? `${c.class_name} ${String(c.section).trim()}` : String(c.class_name || "");'
  );
  fs.writeFileSync("backend/src/routes/analysis.routes.js", t);
  console.log("backend ok");
}

{
  let t = fs.readFileSync("src/pages/AnalysisPage.jsx", "utf8");

  if (!t.includes("function streamLabel")) {
    t = t.replace(
      'import { calculateCbcSubLevel, calculateGrade } from "../lib/grading";',
      `import { calculateCbcSubLevel, calculateGrade } from "../lib/grading";
function streamLabel(s) {
  if (!s) return "—";
  if (typeof s === "string") return s.replace(/\\s+null$/i, "").replace(/\\s+undefined$/i, "").trim() || "—";
  const sec = s.stream ?? s.section;
  if (sec != null && String(sec).trim() && String(sec).toLowerCase() !== "null")
    return \`\${s.class_name || ""} \${String(sec).trim()}\`.trim();
  if (s.stream_label) return String(s.stream_label).replace(/\\s+null$/i, "").replace(/\\s+undefined$/i, "").trim();
  return String(s.class_name || "—");
}
`
    );
  }

  t = t.replaceAll("{s.stream_label}", "{streamLabel(s)}");
  t = t.replaceAll("activeStream === s.stream_label", "activeStream === streamLabel(s)");
  t = t.replaceAll("setActiveStream(isActive ? null : s.stream_label)", "setActiveStream(isActive ? null : streamLabel(s))");
  t = t.replaceAll("s.stream_label === activeStream", "streamLabel(s) === activeStream");

  t = t.replaceAll(
    '<Badge key="grade" text={g.label} style={{ background: g.bg, color: g.color, borderColor: g.color }} />',
    '<Badge key="grade" text={g.sub_level || g.label} style={{ background: g.bg, color: g.color, borderColor: g.color }} />'
  );

  t = t.replaceAll(
    '<div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>',
    '<div className="analysis-table-scroll" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>'
  );

  t = t.replace(
    'headers={["Position", "Student", "Admission No.", "Class", "Average", "Total Marks", "Subjects"]}',
    'headers={["Pos", "Student", "Adm No.", "Class / Stream", "Avg", "Band", "Marks", "Subs"]}'
  );

  if (t.includes("gradeInfo(s.avg_score)") && !t.includes("overall_sub_level || g.sub_level") && t.includes("studentRankings.all_students")) {
    t = t.replace(
      "const g = gradeInfo(s.avg_score);\n                    return [\n                      <span key=\"pos\"",
      "const g = gradeInfo(s.avg_score);\n                    const band = s.overall_sub_level || g.sub_level || g.label;\n                    return [\n                      <span key=\"pos\""
    );
    t = t.replace(
      '<span key="cls" style={{ color: "var(--color-text-secondary)" }}>{s.class_name || "—"}</span>',
      '<span key="cls" style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{streamLabel(s) || s.class_name || "—"}</span>'
    );
    t = t.replace(
      `<div key="avg" style={{ display: "flex", alignItems: "center", gap: "8px" }}>\n                        <ScoreBar score={s.avg_score} color={g.color} />\n                        <span style={{ fontWeight: 800, color: g.color, minWidth: "42px", textAlign: "right" }}>{s.avg_score}%</span>\n                      </div>,\n                      <span key="total"`,
      `<div key="avg" style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 90 }}>\n                        <ScoreBar score={s.avg_score} color={g.color} />\n                        <span style={{ fontWeight: 800, color: g.color, minWidth: "40px", textAlign: "right" }}>{s.avg_score}%</span>\n                      </div>,\n                      <Badge key="band" text={band} style={{ background: g.bg, color: g.color, borderColor: "transparent", fontWeight: 700 }} />,\n                      <span key="total"`
    );
  }

  if (!t.includes("Sub-levels (EE1")) {
    const start = t.indexOf("              {/* Grade Distribution */}");
    const end = t.indexOf("              {/* Subject Breakdown by Class */}");
    if (start >= 0 && end > start) {
      t =
        t.slice(0, start) +
        `              {/* Grade Distribution */}\n              {(Object.keys(classStats.overall?.grade_distribution || {}).length > 0 ||\n                Object.keys(classStats.overall?.sub_level_distribution || {}).length > 0) && (\n                <div style={{ marginBottom: "var(--space-4)" }}>\n                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>\n                    Grade Distribution\n                    {classStats.overall.mean_sub_level ? (\n                      <span style={{ fontWeight: 600, fontSize: 13, marginLeft: 8, color: "var(--color-text-secondary)" }}>\n                        mean {classStats.overall.mean}% · {classStats.overall.mean_sub_level}\n                      </span>\n                    ) : null}\n                  </div>\n                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>\n                    {Object.entries(classStats.overall.grade_distribution || {}).map(([grade, count]) => {\n                      const g = gradeInfo(grade === "EE" ? 85 : grade === "ME" ? 70 : grade === "AE" ? 55 : 30);\n                      return (\n                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: 8, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center" }}>\n                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />\n                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>\n                        </div>\n                      );\n                    })}\n                  </div>\n                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>Sub-levels (EE1 – BE2)</div>\n                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>\n                    {["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].filter(k => (classStats.overall.sub_level_distribution || {})[k]).map((grade) => {\n                      const count = classStats.overall.sub_level_distribution[grade];\n                      const sample = { EE1:95, EE2:85, ME1:75, ME2:67, AE1:58, AE2:52, BE1:45, BE2:25 }[grade];\n                      const g = gradeInfo(sample);\n                      return (\n                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: 8, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center" }}>\n                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />\n                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>\n                        </div>\n                      );\n                    })}\n                  </div>\n                </div>\n              )}\n\n` +
        t.slice(end);
    }
  }

  fs.writeFileSync("src/pages/AnalysisPage.jsx", t);
  console.log("fe", t.includes("function streamLabel"), t.includes("Sub-levels (EE1"), t.includes("Band"));
}
console.log("DONE");
