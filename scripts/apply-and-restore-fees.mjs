import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function restore(sub, destRel) {
  const partsDir = path.join(root, "scripts/fee-fix-data", sub);
  const parts = fs.readdirSync(partsDir).filter(f => f.endsWith(".txt")).sort()
    .map(f => fs.readFileSync(path.join(partsDir, f), "utf8")).join("");
  const dest = path.join(root, destRel);
  fs.writeFileSync(dest, Buffer.from(parts, "base64"));
  console.log("OK", destRel, fs.statSync(dest).size);
}
restore("rt", "backend/src/routes/students.routes.js");
restore("sp", "src/pages/StudentsPage.jsx");
