#!/usr/bin/env node
import fs from "fs";

const path = "src/lib/expenditure.utils.js";
let t = fs.readFileSync(path, "utf8");

const start = t.indexOf("export function formatCurrencyCompact(amount)");
if (start === -1) {
  console.error("formatCurrencyCompact not found");
  process.exit(1);
}

const end = t.indexOf("\n\nexport function formatDate", start);
if (end === -1) {
  console.error("end marker not found");
  process.exit(1);
}

const replacement = `/**\n * Full-digit currency for financial accountability.\n * (Previously abbreviated to K/M — schools need every digit visible.)\n * Kept as an alias so existing imports keep working.\n */\nexport function formatCurrencyCompact(amount) {\n  return formatCurrency(amount);\n}\n`;

t = t.slice(0, start) + replacement + t.slice(end);
fs.writeFileSync(path, t);
console.log("formatCurrencyCompact now returns full digits");

// Dashboard: prefer formatCurrency for KPI values
const dashPath = "src/pages/DashboardPage.jsx";
let d = fs.readFileSync(dashPath, "utf8");
d = d.replaceAll("formatCurrencyCompact(", "formatCurrency(");
if (!d.includes("formatCurrencyCompact")) {
  d = d.replace(
    'import { formatCurrency, formatCurrencyCompact } from "../lib/expenditure.utils";',
    'import { formatCurrency } from "../lib/expenditure.utils";'
  );
}
fs.writeFileSync(dashPath, d);
console.log("Dashboard KPIs use full digits");
