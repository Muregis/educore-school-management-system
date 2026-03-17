import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Write NDJSON logs to workspace root: debug-cdda91.log
const LOG_PATH = path.resolve(__dirname, "../../../debug-cdda91.log");

export function agentLog(payload) {
  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    // Never throw from debug logging
  }
}

