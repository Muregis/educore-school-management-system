#!/usr/bin/env node
import fs from "fs";
import https from "https";

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const url = "https://raw.githubusercontent.com/Muregis/educore-school-management-system/main/src/pages/ReportsPage.jsx";
let t = await get(url);
console.log("downloaded", t.length);

const old = `      const [trendRes, topRes, rankRes, statsRes] = await Promise.all([
        apiFetch(\`/analysis/trends\${className ? \`?class_name=\${encodeURIComponent(className)}\` : ""}\`, { token: auth.token }),
        apiFetch(\`/analysis/top-students?limit=10\${term ? \`&term=\${encodeURIComponent(term)}\` : ""}\${className ? \`&class_name=\${encodeURIComponent(className)}\` : ""}\`, { token: auth.token }),
        apiFetch(\`/analysis/student-rankings?term=\${encodeURIComponent(term)}\${className ? \`&class_name=\${encodeURIComponent(className)}\` : ""}\`, { token: auth.token }),
        apiFetch(\`/analysis/class-stats?term=\${encodeURIComponent(term)}\${className ? \`&class_name=\${encodeURIComponent(className)}\` : ""}\`, { token: auth.token }),
      ]);
      setTrends(trendRes);
      setTopStudents(topRes);
      setStudentRankings(rankRes);
      setClassStats(statsRes);`;

const neu = `      const trendQ = className ? \`?class_name=\${encodeURIComponent(className)}\` : "";
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
      setClassStats(val(3));`;

if (!t.includes(old)) {
  console.error("promise block missing on main");
  process.exit(1);
}
t = t.replace(old, neu);

t = t.split("data={data.subjectRankings.map((s, i) => {").join("data={(data.subjectRankings || []).map((s, i) => {");
t = t.split("{data.streamVsSubject.subjects.length > 0 && (").join("{(data.streamVsSubject?.subjects || []).length > 0 && (");
t = t.split('headers={["Subject", ...data.streamVsSubject.streams]}').join('headers={["Subject", ...(data.streamVsSubject?.streams || [])]}');
t = t.split("data={data.streamVsSubject.subjects.map(subj => {").join("data={(data.streamVsSubject?.subjects || []).map(subj => {");
t = t.split("data.streamVsSubject.streams.forEach(sl => {").join("(data.streamVsSubject?.streams || []).forEach(sl => {");
t = t.split("const score = data.streamVsSubject.data[sl]?.[subj];").join("const score = data.streamVsSubject?.data?.[sl]?.[subj];");

const oldM = `    const sorted = (data && data.streamAverages) ? [...data.streamAverages].sort((a,b) => b.avg_score - a.avg_score) : [];
    
    const classMap = {};
    sorted.forEach(s => {
      if (!classMap[s.class_name]) classMap[s.class_name] = [];
      classMap[s.class_name].push(s);
    });`;
const newM = `    const cleaned = (data?.streamAverages || []).map((s) => {
      const stream = s.stream && s.stream !== "null" ? s.stream : null;
      const label = stream
        ? (s.stream_label && !String(s.stream_label).includes("null") ? s.stream_label : \`\${s.class_name} \${stream}\`.trim())
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
if (!t.includes(oldM)) {
  console.error("memo missing");
  process.exit(1);
}
t = t.replace(oldM, newM);

if (t.includes("ec-analysis-visual")) process.exit(2);
if (t.includes("}  }, [auth")) process.exit(3);
if (!t.includes("Promise.allSettled")) process.exit(4);

fs.writeFileSync("src/pages/ReportsPage.jsx", t);
console.log("SAFE PATCH OK", t.length);
