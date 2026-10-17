#!/usr/bin/env node
import fs from "fs";

{
  const path = "backend/src/routes/analysis.routes.js";
  let t = fs.readFileSync(path, "utf8");
  const start = t.indexOf('router.get("/merit"');
  if (start === -1) {
    console.error("merit route not found");
    process.exit(1);
  }
  const end = t.indexOf("export default router;", start);
  const snippet = fs.readFileSync("scripts/merit-route-v2.js", "utf8");
  t = t.slice(0, start) + snippet + "\n\n" + t.slice(end);
  fs.writeFileSync(path, t);
  console.log("merit route updated");
}

{
  const path = "src/pages/MeritListPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  const old = `        const cList = Array.isArray(classesRes) ? classesRes : (classesRes?.data || classesRes?.classes || []);\n        const classNames = [...new Set(cList.map((c) => c.class_name || c.name).filter(Boolean))].sort();\n        setClasses(classNames);\n        if (classNames[0]) setClassName((c) => c || classNames[0]);`;
  const neu = `        const cList = Array.isArray(classesRes)\n          ? classesRes\n          : (classesRes?.data || classesRes?.classes || classesRes?.rows || []);\n        const rawNames = cList.map((c) => c.class_name || c.name).filter(Boolean);\n        const bases = rawNames.map((n) => {\n          const m = String(n).trim().match(/^(Grade\\s*\\d+|Form\\s*\\d+|PP\\d?|Playgroup)/i);\n          return m ? m[1].replace(/\\s+/g, " ") : String(n).trim();\n        });\n        const classNames = [...new Set(bases.length ? bases : rawNames)].sort((a, b) =>\n          a.localeCompare(b, undefined, { numeric: true })\n        );\n        setClasses(classNames);\n        if (classNames[0]) setClassName((c) => c || classNames[0]);`;
  if (t.includes(old)) {
    t = t.replace(old, neu);
    fs.writeFileSync(path, t);
    console.log("MeritListPage updated");
  } else if (t.includes("classesRes?.rows")) {
    console.log("MeritListPage already hardened");
  } else {
    console.warn("MeritListPage pattern not found — manual check");
  }
}

console.log("apply-merit-hardening done");
