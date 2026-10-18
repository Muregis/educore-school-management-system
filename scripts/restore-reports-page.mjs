#!/usr/bin/env node
import fs from "fs";
const parts = [0,1,2,3,4,5].map(i => fs.readFileSync(`scripts/rp-part${i}.b64`, "utf8").replace(/\s+/g, ""));
const buf = Buffer.from(parts.join(""), "base64");
fs.writeFileSync("src/pages/ReportsPage.jsx", buf);
const t = buf.toString("utf8");
if (t.includes("}  }, [auth")) { console.error("bad callback"); process.exit(1); }
if (!t.includes("Promise.allSettled")) { console.error("missing allSettled"); process.exit(1); }
if (!t.includes("Sub-levels (EE1")) { console.error("missing sublevels"); process.exit(1); }
const b = (t.match(/{/g)||[]).length - (t.match(/}/g)||[]).length;
const p = (t.match(/\(/g)||[]).length - (t.match(/\)/g)||[]).length;
if (b !== 0 || p !== 0) { console.error("balance", b, p); process.exit(1); }
console.log("ReportsPage restored", buf.length, "bytes OK");
