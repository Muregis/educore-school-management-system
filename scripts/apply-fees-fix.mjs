#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";

if (!fs.existsSync("scripts/fees-page.patch")) {
  console.error("Missing scripts/fees-page.patch");
  process.exit(1);
}
try {
  execSync("git apply --whitespace=nowarn scripts/fees-page.patch", { stdio: "inherit" });
  console.log("FeesPage patch applied");
} catch {
  execSync("git apply --3way --whitespace=nowarn scripts/fees-page.patch", { stdio: "inherit" });
  console.log("FeesPage patch applied (3way)");
}
