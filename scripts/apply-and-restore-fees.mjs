#!/usr/bin/env node
/**
 * Fix student fee settings (run from repo root on a clean main checkout):
 *   node scripts/apply-and-restore-fees.mjs
 *
 * - Wires StudentFeeSettingsBlock into Add/Edit student modal
 * - Stops sending lunch_fee/transport_fee (schema cache 500)
 * - Stops writing those columns in PATCH /students/:id/fees
 * - Shows fee summary on student profile
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function patch(rel, replacements) {
  const file = path.join(root, rel);
  let s = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [from, to] of replacements) {
    if (!s.includes(from)) {
      console.warn("SKIP (already applied or mismatch):", rel, from.slice(0, 50).replace(/\n/g, " "));
      continue;
    }
    s = s.split(from).join(to);
    n++;
  }
  fs.writeFileSync(file, s);
  console.log("patched", rel, n, "replacements");
}

patch("src/pages/StudentsPage.jsx", [
  [
    'import Table from "../components/ui/Table";',
    'import Table from "../components/ui/Table";\nimport StudentFeeSettingsBlock from "../components/StudentFeeSettingsBlock";',
  ],
  [
    `          <Select label="Status" value={f.status} onChange={e => handleChange('status', e.target.value)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />\n        </div>\n        {err &&`,
    `          <Select label="Status" value={f.status} onChange={e => handleChange('status', e.target.value)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />\n          <StudentFeeSettingsBlock f={f} onChange={handleChange} />\n        </div>\n        {err &&`,
  ],
  [
    `        const patchPayload = {\n          opening_balance: parseFloat(f.opening_balance) || 0,\n          opening_balance_type: f.opening_balance_type || "owing",\n          transport_fee: f.transport_fee === "" ? 0 : parseFloat(f.transport_fee) || 0,\n          transport_direction: f.transport_direction || "none",\n          transport_base_fee: parseFloat(f.transport_base_fee) || 0,\n          lunch_fee: f.lunch_fee === "" ? 0 : parseFloat(f.lunch_fee) || 0,\n          lunch_enabled: Boolean(f.lunch_enabled),\n          lunch_daily_rate: parseFloat(f.lunch_daily_rate) || 0,\n          lunch_days: f.lunch_days ? parseInt(f.lunch_days) : null,\n          lunch_billing_type: f.lunch_billing_type || "daily",\n          breakfast_termly_fee: f.breakfast_termly_fee === "" ? 0 : parseFloat(f.breakfast_termly_fee) || 0,\n          breakfast_enabled: Boolean(f.breakfast_enabled),\n          breakfast_daily_rate: parseFloat(f.breakfast_daily_rate) || 0,\n          breakfast_days: f.breakfast_days ? parseInt(f.breakfast_days) : null,\n          breakfast_billing_type: f.breakfast_billing_type || "daily",\n          discount_type: f.discount_type || null,\n          discount_value: parseFloat(f.discount_value) || 0,\n          discount_is_percentage: f.discount_is_percentage !== false,\n        };`,
    `        // Omit lunch_fee/transport_fee — missing on some DBs (schema cache 500)\n        const patchPayload = {\n          opening_balance: parseFloat(f.opening_balance) || 0,\n          opening_balance_type: f.opening_balance_type || "owing",\n          transport_direction: f.transport_direction || "none",\n          transport_base_fee: parseFloat(f.transport_base_fee) || 0,\n          lunch_enabled: Boolean(f.lunch_enabled),\n          lunch_daily_rate: parseFloat(f.lunch_daily_rate) || 0,\n          lunch_days: f.lunch_days ? parseInt(f.lunch_days, 10) : null,\n          lunch_billing_type: f.lunch_billing_type || "termly",\n          breakfast_termly_fee: f.breakfast_termly_fee === "" || f.breakfast_termly_fee == null ? 0 : parseFloat(f.breakfast_termly_fee) || 0,\n          breakfast_enabled: Boolean(f.breakfast_enabled),\n          breakfast_daily_rate: parseFloat(f.breakfast_daily_rate) || 0,\n          breakfast_days: f.breakfast_days ? parseInt(f.breakfast_days, 10) : null,\n          breakfast_billing_type: f.breakfast_billing_type || "termly",\n          discount_type: f.discount_type || null,\n          discount_value: parseFloat(f.discount_value) || 0,\n          discount_is_percentage: f.discount_is_percentage !== false,\n        };`,
  ],
  [
    `            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>NEMIS</div><div style={{ fontWeight: 600 }}>{profile.nemisNumber || "—"}</div></div>\n          </div>\n        </Modal>`,
    `            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>NEMIS</div><div style={{ fontWeight: 600 }}>{profile.nemisNumber || "—"}</div></div>\n            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Opening balance</div><div style={{ fontWeight: 600 }}>{profile.opening_balance != null ? \`\${Number(profile.opening_balance).toLocaleString()} (\${profile.opening_balance_type || "owing"})\` : "—"}</div></div>\n            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Transport</div><div style={{ fontWeight: 600 }}>{profile.transport_direction && profile.transport_direction !== "none" ? \`\${profile.transport_direction} · KES \${Number(profile.transport_base_fee || 0).toLocaleString()}\` : "None"}</div></div>\n            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Lunch</div><div style={{ fontWeight: 600 }}>{profile.lunch_enabled ? \`Yes · \${profile.lunch_billing_type || "termly"}\` : "No"}</div></div>\n            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Breakfast</div><div style={{ fontWeight: 600 }}>{profile.breakfast_enabled ? "Yes" : "No"}</div></div>\n          </div>\n        </Modal>`,
  ],
]);

patch("backend/src/routes/students.routes.js", [
  [
    `    if (outstanding_balance !== undefined) updateData.outstanding_balance = parseFloat(outstanding_balance) || 0;\n    if (transport_fee !== undefined) updateData.transport_fee = parseFloat(transport_fee) || 0;\n    if (lunch_fee !== undefined) updateData.lunch_fee = parseFloat(lunch_fee) || 0;\n    if (breakfast_termly_fee !== undefined) updateData.breakfast_termly_fee = parseFloat(breakfast_termly_fee) || 0;`,
    `    if (outstanding_balance !== undefined) updateData.outstanding_balance = parseFloat(outstanding_balance) || 0;\n    // transport_fee / lunch_fee omitted — not present on all tenants (PostgREST schema cache 500)\n    if (breakfast_termly_fee !== undefined) updateData.breakfast_termly_fee = parseFloat(breakfast_termly_fee) || 0;`,
  ],
]);

console.log("\nDone. Next:");
console.log("  git add src/pages/StudentsPage.jsx backend/src/routes/students.routes.js");
console.log("  git commit -m 'fix(students): restore fee UI; omit lunch_fee/transport_fee'");
console.log("  git push && merge to main, deploy Vercel + Render");
