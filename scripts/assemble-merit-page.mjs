#!/usr/bin/env node
import fs from "fs";
import { readdirSync } from "fs";
const parts = readdirSync("scripts")
  .filter(f => f.startsWith("merit-b64-part") && f.endsWith(".txt"))
  .sort((a,b) => Number(a.replace(/\D/g,"")) - Number(b.replace(/\D/g,"")));
const b64 = parts.map(f => fs.readFileSync("scripts/"+f, "utf8").trim()).join("");
fs.mkdirSync("src/pages", { recursive: true });
fs.writeFileSync("src/pages/MeritListPage.jsx", Buffer.from(b64, "base64").toString("utf8"));
console.log("MeritListPage.jsx assembled", fs.statSync("src/pages/MeritListPage.jsx").size);
