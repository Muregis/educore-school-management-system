#!/usr/bin/env node
import fs from "fs";
const parts = fs.readdirSync("scripts").filter(f => f.startsWith("analysis-apply-b64-")).sort((a,b)=>Number(a.replace(/\D/g,""))-Number(b.replace(/\D/g,"")));
const b64 = parts.map(f => fs.readFileSync("scripts/"+f,"utf8").trim()).join("");
fs.writeFileSync("scripts/apply-analysis-page-fix.mjs", Buffer.from(b64,"base64"));
console.log("wrote apply script", fs.statSync("scripts/apply-analysis-page-fix.mjs").size);
