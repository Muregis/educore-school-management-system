#!/usr/bin/env node
import fs from "fs";
const parts = fs.readdirSync("scripts").filter(f=>f.startsWith("acbc-part")).sort((a,b)=>Number(a.replace(/\D/g,""))-Number(b.replace(/\D/g,"")));
const b64=parts.map(f=>fs.readFileSync("scripts/"+f,"utf8").trim()).join("");
fs.writeFileSync("scripts/apply-analysis-cbc.mjs", Buffer.from(b64,"base64").toString("utf8"));
console.log("assembled apply", fs.statSync("scripts/apply-analysis-cbc.mjs").size);
