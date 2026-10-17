#!/usr/bin/env node
import fs from "fs";
function assemble(prefix, dest) {
  const parts = fs.readdirSync("scripts")
    .filter(f => f.startsWith(prefix + "-part") && f.endsWith(".txt"))
    .sort((a,b) => Number(a.replace(/\D/g,"")) - Number(b.replace(/\D/g,"")));
  if (!parts.length) { console.error("no parts for", prefix); process.exit(1); }
  const b64 = parts.map(f => fs.readFileSync("scripts/"+f,"utf8").trim()).join("");
  fs.writeFileSync(dest, Buffer.from(b64, "base64"));
  console.log("wrote", dest, fs.statSync(dest).size);
}
assemble("analysis", "backend/src/routes/analysis.routes.js");
assemble("grades", "backend/src/routes/grades.routes.js");
assemble("settings", "backend/src/routes/settings.routes.js");
