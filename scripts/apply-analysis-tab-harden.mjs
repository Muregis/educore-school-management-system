#!/usr/bin/env node
import fs from "fs";
const path = "src/pages/ReportsPage.jsx";
let t = fs.readFileSync(path, "utf8");

if (!t.includes("Promise.allSettled")) {
  const start = t.indexOf("  const load = useCallback(async () => {");
  const end = t.indexOf("  }, [auth, term, className]);", start);
  if (start < 0 || end < 0) { console.error("load not found"); process.exit(1); }
  const newLoad = `  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    setAiReport(""); setAiError("");
    try {
      const qs = new URLSearchParams({ term });
      if (className) qs.set("class_name", className);
      const result = await apiFetch(\`/analysis/streams?\${qs}\`, { token: auth.token });
      setData(result || { streamAverages: [], subjectRankings: [], streamVsSubject: { streams: [], subjects: [], data: {} }, terms: [], classes: [] });
      if (result?.terms?.length) setAvailTerms(result.terms);
      if (result?.classes?.length) setAvailClasses(result.classes);
      setActiveStream(null);
      const trendQ = className ? \`?class_name=\${encodeURIComponent(className)}\` : "";
      const termQ = term ? \`term=\${encodeURIComponent(term)}\` : "";
      const classQ = className ? \`&class_name=\${encodeURIComponent(className)}\` : "";
      const settled = await Promise.allSettled([
        apiFetch(\`/analysis/trends\${trendQ}\`, { token: auth.token }),
        apiFetch(\`/analysis/top-students?limit=10\${termQ ? \`&\${termQ}\` : ""}\${classQ}\`, { token: auth.token }),
        apiFetch(\`/analysis/student-rankings?\${termQ}\${classQ}\`, { token: auth.token }),
        apiFetch(\`/analysis/class-stats?\${termQ}\${classQ}\`, { token: auth.token }),
      ]);
      const val = (i) => (settled[i].status === "fulfilled" ? settled[i].value : null);
      settled.forEach((s, i) => { if (s.status === "rejected") console.warn("Analysis secondary API", i, s.reason); });
      setTrends(val(0));
      setTopStudents(val(1));
      setStudentRankings(val(2));
      setClassStats(val(3));
      setIsInitialized(true);
    } catch (e) {
      console.error("Analysis error:", e);
      setData({ streamAverages: [], subjectRankings: [], streamVsSubject: { streams: [], subjects: [], data: {} }, terms: [], classes: [] });
    }
    setLoading(false);
  }`;
  t = t.slice(0, start) + newLoad + t.slice(end);
}

t = t.split("data={data.subjectRankings.map((s, i) => {").join("data={(data.subjectRankings || []).map((s, i) => {");
t = t.split("{data.streamVsSubject.subjects.length > 0 && (").join("{(data.streamVsSubject?.subjects || []).length > 0 && (");
t = t.split('headers={["Subject", ...data.streamVsSubject.streams]}').join('headers={["Subject", ...(data.streamVsSubject?.streams || [])]}');
t = t.split("data={data.streamVsSubject.subjects.map(subj => {").join("data={(data.streamVsSubject?.subjects || []).map(subj => {");
t = t.split("data.streamVsSubject.streams.forEach(sl => {").join("(data.streamVsSubject?.streams || []).forEach(sl => {");
t = t.split("const score = data.streamVsSubject.data[sl]?.[subj];").join("const score = data.streamVsSubject?.data?.[sl]?.[subj];");

if (!t.includes("stream_label: label")) {
  const oldSorted = `    const sorted = (data && data.streamAverages) ? [...data.streamAverages].sort((a,b) => b.avg_score - a.avg_score) : [];
    
    const classMap = {};
    sorted.forEach(s => {
      if (!classMap[s.class_name]) classMap[s.class_name] = [];
      classMap[s.class_name].push(s);
    });`;
  const newSorted = `    const cleaned = (data?.streamAverages || []).map((s) => {
      const stream = s.stream && s.stream !== "null" ? s.stream : null;
      const label = stream
        ? (s.stream_label && !String(s.stream_label).includes("null")
            ? s.stream_label
            : \`\${s.class_name} \${stream}\`.trim())
        : (s.class_name || s.stream_label || "Class");
      return { ...s, stream, stream_label: label };
    });
    const sorted = [...cleaned].sort((a,b) => (b.avg_score || 0) - (a.avg_score || 0));
    
    const classMap = {};
    sorted.forEach(s => {
      const cn = s.class_name || "Other";
      if (!classMap[cn]) classMap[cn] = [];
      classMap[cn].push(s);
    });`;
  if (t.includes(oldSorted)) t = t.replace(oldSorted, newSorted);
}

if (!t.includes("ec-analysis-visual")) {
  t = t.replace(
    '{!loading && data && reportMode === "visual" && (',
    '{!loading && data && reportMode === "visual" && (!(data.streamAverages || []).length && !(data.subjectRankings || []).length) && (\n        <EmptyState icon="📊" title="No analysis data" description="No results for this term/class yet. Enter grades first, then refresh." />\n      )}\n\n      {!loading && data && reportMode === "visual" && ((data.streamAverages || []).length > 0 || (data.subjectRankings || []).length > 0) && (\n        <div className="ec-analysis-visual" style={{ display: "grid", gap: "var(--space-4)", maxWidth: "100%", overflowX: "hidden" }}>'
  );
}

if (!t.includes("Sub-levels (EE1")) {
  const gidx = t.indexOf("{/* Grade Distribution */}");
  const gend = t.indexOf("{/* Subject Breakdown by Class */}");
  if (gidx >= 0 && gend > gidx) {
    t = t.slice(0, gidx) + `{/* Grade Distribution + EE1–BE2 */}
              {(Object.keys(classStats.overall.grade_distribution || {}).length > 0 ||
                Object.keys(classStats.overall.sub_level_distribution || {}).length > 0) && (
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>
                    Grade Distribution
                    {classStats.overall.mean_sub_level ? (
                      <span style={{ fontWeight: 600, fontSize: 13, marginLeft: 8, color: "var(--color-text-secondary)" }}>
                        mean {classStats.overall.mean}% · {classStats.overall.mean_sub_level}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {Object.entries(classStats.overall.grade_distribution || {}).map(([grade, count]) => {
                      const g = gradeInfo(grade === "EE" ? 85 : grade === "ME" ? 70 : grade === "AE" ? 55 : 30);
                      return (
                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: 8, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />
                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>Sub-levels (EE1 – BE2)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["EE1","EE2","ME1","ME2","AE1","AE2","BE1","BE2"].filter(k => (classStats.overall.sub_level_distribution || {})[k]).map((grade) => {
                      const count = classStats.overall.sub_level_distribution[grade];
                      const sample = { EE1:95, EE2:85, ME1:75, ME2:67, AE1:58, AE2:52, BE1:45, BE2:25 }[grade];
                      const g = gradeInfo(sample);
                      return (
                        <div key={grade} style={{ background: g.bg, border: \`1px solid \${g.color}\`, borderRadius: 8, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />
                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              ` + t.slice(gend);
  }
}

t = t.replace(/style=\{\{ width: "150px" \}\}/g, 'style={{ flex: "1 1 140px", minWidth: 0, maxWidth: "100%" }}');

fs.writeFileSync(path, t);
console.log("OK", t.includes("Promise.allSettled"), t.includes("Sub-levels (EE1"), t.includes("ec-analysis-visual"));
