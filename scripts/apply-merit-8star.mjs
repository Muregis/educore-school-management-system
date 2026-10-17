#!/usr/bin/env node
import fs from "fs";
const path = "src/pages/MeritListPage.jsx";
let t = fs.readFileSync(path, "utf8");
if (t.includes("Class mean")) {
  console.log("already has KPIs");
  process.exit(0);
}
const needle = `  const subjects = data?.subjects || [];\n  const rows = data?.rows || [];\n  const streams = data?.streams || [];`;
const insert = `  const subjects = data?.subjects || [];\n  const rows = data?.rows || [];\n  const streams = data?.streams || [];\n\n  const stats = useMemo(() => {\n    if (!rows.length) return null;\n    const avgs = rows.map((r) => Number(r.average) || 0);\n    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;\n    const bands = { EE: 0, ME: 0, AE: 0, BE: 0 };\n    for (const r of rows) {\n      const g = String(r.overall_grade || r.overall_sub_level || "").replace(/[12]$/, "").toUpperCase();\n      if (g in bands) bands[g] += 1;\n    }\n    const top = rows[0];\n    return {\n      mean: Number(mean.toFixed(2)),\n      count: rows.length,\n      bands,\n      topName: top ? \`${top.first_name || ""} ${top.last_name || ""}\`.trim() : "—",\n      topAvg: top ? Number(top.average).toFixed(2) : "—",\n      topLevel: top?.overall_sub_level || "—",\n    };\n  }, [rows]);`;
if (!t.includes(needle)) {
  console.error("needle missing");
  process.exit(1);
}
t = t.replace(needle, insert);
const marker = `      <div className=\"merit-print-root\">`;
const kpi = `\n      {stats && (\n        <div className=\"no-print\" style={{\n          display: \"grid\",\n          gridTemplateColumns: \"repeat(auto-fit, minmax(140px, 1fr))\",\n          gap: 10,\n          marginBottom: 14,\n        }}>\n          {[\n            { label: \"Learners\", value: String(stats.count), sub: \"on this list\" },\n            { label: \"Class mean\", value: String(stats.mean), sub: \"average %\" },\n            { label: \"Top learner\", value: stats.topName, sub: \`${stats.topAvg} · ${stats.topLevel}\` },\n            { label: \"EE / ME / AE / BE\", value: \`${stats.bands.EE} / ${stats.bands.ME} / ${stats.bands.AE} / ${stats.bands.BE}\`, sub: \"parent bands\" },\n          ].map((k) => (\n            <div key={k.label} style={{\n              border: \"1px solid #e2e8f0\", borderRadius: 12, padding: \"12px 14px\",\n              background: \"#fff\",\n            }}>\n              <div style={{ fontSize: 11, fontWeight: 700, color: \"#64748b\", textTransform: \"uppercase\", letterSpacing: \"0.04em\" }}>{k.label}</div>\n              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, lineHeight: 1.2 }}>{k.value}</div>\n              <div style={{ fontSize: 12, color: \"#94a3b8\", marginTop: 2 }}>{k.sub}</div>\n            </div>\n          ))}\n        </div>\n      )}\n`;
if (!t.includes('className="merit-print-root"')) {
  console.error("marker missing");
  process.exit(1);
}
t = t.replace('      <div className="merit-print-root">', kpi + '\n      <div className="merit-print-root">');
fs.writeFileSync(path, t);
console.log("MeritListPage KPIs applied");
