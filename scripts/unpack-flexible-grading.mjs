#!/usr/bin/env node
import fs from "fs";
import { execSync } from "child_process";
const parts = fs.readdirSync("scripts")
  .filter(f => f.startsWith("bundle-chunk") && f.endsWith(".txt"))
  .sort((a,b) => Number(a.replace(/\D/g,"")) - Number(b.replace(/\D/g,"")));
const b64 = parts.map(f => fs.readFileSync("scripts/"+f,"utf8").trim()).join("");
fs.writeFileSync("/tmp/flex-grading.tgz", Buffer.from(b64, "base64"));
execSync("mkdir -p /tmp/flex-out && tar -xzf /tmp/flex-grading.tgz -C /tmp/flex-out");
const map = {
  "classes.routes.js": "backend/src/routes/classes.routes.js",
  "gradingBands.js": "backend/src/utils/gradingBands.js",
  "knecGrading.js": "backend/src/utils/knecGrading.js",
  "demo_grade2_streams.sql": "database/scripts/demo_grade2_streams.sql",
  "assemble-flexible-grading.mjs": "scripts/assemble-flexible-grading.mjs",
};
for (const [src, dest] of Object.entries(map)) {
  const from = `/tmp/flex-out/${src}`;
  if (fs.existsSync(from)) {
    fs.mkdirSync(dest.split("/").slice(0,-1).join("/"), { recursive: true });
    fs.copyFileSync(from, dest);
    console.log("copied", dest);
  }
}
for (const f of fs.readdirSync("/tmp/flex-out")) {
  if (f.includes("-chunk") && f.endsWith(".txt")) {
    fs.copyFileSync(`/tmp/flex-out/${f}`, `scripts/${f}`);
  }
}
if (fs.existsSync("scripts/assemble-flexible-grading.mjs")) {
  execSync("node scripts/assemble-flexible-grading.mjs", { stdio: "inherit" });
}
console.log("unpack done");
