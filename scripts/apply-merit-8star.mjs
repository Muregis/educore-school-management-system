#!/usr/bin/env node
import fs from "fs";
const path = "src/pages/MeritListPage.jsx";
let t = fs.readFileSync(path, "utf8");
if (t.includes("CLASS MEAN") || t.includes("Class mean")) {
  console.log("already");
  process.exit(0);
}
if (!t.includes("const streams = data?.streams || [];")) {
  console.error("structure changed");
  process.exit(1);
}
const statsBlock = `
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const avgs = rows.map((r) => Number(r.average) || 0);
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const bands = { EE: 0, ME: 0, AE: 0, BE: 0 };
    for (const r of rows) {
      const g = String(r.overall_grade || r.overall_sub_level || "").replace(/[12]$/, "").toUpperCase();
      if (g in bands) bands[g] += 1;
    }
    const top = rows[0];
    return {
      mean: Number(mean.toFixed(2)),
      count: rows.length,
      bands,
      topName: top ? (String(top.first_name || "") + " " + String(top.last_name || "")).trim() : "-",
      topAvg: top ? Number(top.average).toFixed(2) : "-",
      topLevel: top?.overall_sub_level || "-",
    };
  }, [rows]);
`;
t = t.replace(
  "  const streams = data?.streams || [];",
  "  const streams = data?.streams || [];\n" + statsBlock
);
const kpiJsx = `
      {stats ? (
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>LEARNERS</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.count}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>CLASS MEAN</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.mean}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>TOP LEARNER</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{stats.topName}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{stats.topAvg} · {stats.topLevel}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>EE / ME / AE / BE</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{stats.bands.EE} / {stats.bands.ME} / {stats.bands.AE} / {stats.bands.BE}</div>
          </div>
        </div>
      ) : null}
`;
if (!t.includes('className="merit-print-root"')) {
  console.error("no print root");
  process.exit(1);
}
t = t.replace(
  '      <div className="merit-print-root">',
  kpiJsx + '\n      <div className="merit-print-root">'
);
fs.writeFileSync(path, t);
if (!t.includes("CLASS MEAN")) {
  console.error("kpi missing");
  process.exit(1);
}
console.log("OK KPIs");
