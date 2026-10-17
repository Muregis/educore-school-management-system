#!/usr/bin/env node
import fs from "fs";

const path = "src/pages/AnalyticsPage.jsx";
let t = fs.readFileSync(path, "utf8");

const oldBy = '    const byClass = countBy(students, "className");';
const newBy = `    const byClass = students.reduce((acc, s) => {
      const name = String(s?.className ?? s?.class_name ?? "").trim() || "Unassigned";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});`;
if (t.includes(oldBy)) {
  t = t.replace(oldBy, newBy);
  console.log("byClass fixed");
} else {
  console.log("byClass already patched or missing");
}

const oldChart = `  const classChartData = useMemo(() => {
    return Object.entries(stats.byClass).map(([name, value]) => ({
      label: name,
      value,
      color: "var(--color-primary)",
    }));
  }, [stats.byClass]);`;
const newChart = `  const classChartData = useMemo(() => {
    return Object.entries(stats.byClass)
      .filter(([name, value]) => name && name !== "undefined" && name !== "null" && Number(value) > 0)
      .map(([name, value]) => ({
        label: name,
        value: Number(value) || 0,
        color: "var(--color-primary)",
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats.byClass]);`;
if (t.includes(oldChart)) {
  t = t.replace(oldChart, newChart);
  console.log("classChartData fixed");
}

t = t.replace(
  '{ id: "ai-analysis", label: "🤖 AI Analysis" },',
  '{ id: "ai-analysis", label: "AI" },'
);

fs.writeFileSync(path, t);
console.log("DONE", t.includes("class_name"), t.includes("Unassigned"));
