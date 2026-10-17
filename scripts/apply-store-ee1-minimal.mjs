#!/usr/bin/env node
import fs from "fs";
const path = "backend/src/routes/grades.routes.js";
let t = fs.readFileSync(path, "utf8");
t = t.split("grade: calculatedGrade.level, // Store EE, ME, AE, BE").join(
  "grade: calculatedGrade.grade || calculatedGrade.level, // EE1-BE2"
);
t = t.split(".update({ grade: calculatedGrade.level })").join(
  ".update({ grade: calculatedGrade.grade || calculatedGrade.level })"
);
t = t.split("grade: calculatedGrade.level,").join(
  "grade: calculatedGrade.grade || calculatedGrade.level,"
);
fs.writeFileSync(path, t);
if (!t.includes("calculatedGrade.grade || calculatedGrade.level")) {
  console.error("FAIL: no replacements");
  process.exit(1);
}
console.log("OK", (t.match(/calculatedGrade\.grade \|\| calculatedGrade\.level/g) || []).length);
