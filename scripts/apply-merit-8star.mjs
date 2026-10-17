#!/usr/bin/env node
import fs from "fs";
const parts = fs.readdirSync("scripts").filter(f => f.startsWith("m8-part") && f.endsWith(".txt"))
  .sort((a,b) => Number(a.replace(/\D/g,"")) - Number(b.replace(/\D/g,"")));
const b64 = parts.map(f => fs.readFileSync("scripts/"+f,"utf8").trim()).join("");
fs.writeFileSync("src/pages/MeritListPage.jsx", Buffer.from(b64,"base64").toString("utf8"));
const t = fs.readFileSync("src/pages/MeritListPage.jsx","utf8");
if (!t.includes("Class mean")) { console.error("fail"); process.exit(1); }
console.log("OK", t.length);
