#!/usr/bin/env node
/**
 * Apply student fee-settings fixes in-place (run from repo root).
 *   node scripts/apply-student-fee-fixes.mjs
 *
 * 1) Wire StudentFeeSettingsBlock into StudentsPage
 * 2) Stop sending lunch_fee / transport_fee in PATCH payload
 * 3) Stop writing those columns in students.routes.js
 * 4) Show fee summary on student profile
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
      console.warn("SKIP (not found):", rel, from.slice(0, 60).replace(/\n/g, "\\n"));
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
    `          <Select label="Status" value={f.status} onChange={e => handleChange('status', e.target.value)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        </div>
        {err &&`,
    `          <Select label="Status" value={f.status} onChange={e => handleChange('status', e.target.value)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          <StudentFeeSettingsBlock f={f} onChange={handleChange} />
        </div>
        {err &&`,
  ],
  [
    `        const patchPayload = {
          opening_balance: parseFloat(f.opening_balance) || 0,
          opening_balance_type: f.opening_balance_type || "owing",
          transport_fee: f.transport_fee === "" ? 0 : parseFloat(f.transport_fee) || 0,
          transport_direction: f.transport_direction || "none",
          transport_base_fee: parseFloat(f.transport_base_fee) || 0,
          lunch_fee: f.lunch_fee === "" ? 0 : parseFloat(f.lunch_fee) || 0,
          lunch_enabled: Boolean(f.lunch_enabled),
          lunch_daily_rate: parseFloat(f.lunch_daily_rate) || 0,
          lunch_days: f.lunch_days ? parseInt(f.lunch_days) : null,
          lunch_billing_type: f.lunch_billing_type || "daily",
          breakfast_termly_fee: f.breakfast_termly_fee === "" ? 0 : parseFloat(f.breakfast_termly_fee) || 0,
          breakfast_enabled: Boolean(f.breakfast_enabled),
          breakfast_daily_rate: parseFloat(f.breakfast_daily_rate) || 0,
          breakfast_days: f.breakfast_days ? parseInt(f.breakfast_days) : null,
          breakfast_billing_type: f.breakfast_billing_type || "daily",
          discount_type: f.discount_type || null,
          discount_value: parseFloat(f.discount_value) || 0,
          discount_is_percentage: f.discount_is_percentage !== false,
        };`,
    `        // Omit lunch_fee/transport_fee — missing on some DBs (schema cache 500)
        const patchPayload = {
          opening_balance: parseFloat(f.opening_balance) || 0,
          opening_balance_type: f.opening_balance_type || "owing",
          transport_direction: f.transport_direction || "none",
          transport_base_fee: parseFloat(f.transport_base_fee) || 0,
          lunch_enabled: Boolean(f.lunch_enabled),
          lunch_daily_rate: parseFloat(f.lunch_daily_rate) || 0,
          lunch_days: f.lunch_days ? parseInt(f.lunch_days, 10) : null,
          lunch_billing_type: f.lunch_billing_type || "termly",
          breakfast_termly_fee: f.breakfast_termly_fee === "" || f.breakfast_termly_fee == null ? 0 : parseFloat(f.breakfast_termly_fee) || 0,
          breakfast_enabled: Boolean(f.breakfast_enabled),
          breakfast_daily_rate: parseFloat(f.breakfast_daily_rate) || 0,
          breakfast_days: f.breakfast_days ? parseInt(f.breakfast_days, 10) : null,
          breakfast_billing_type: f.breakfast_billing_type || "termly",
          discount_type: f.discount_type || null,
          discount_value: parseFloat(f.discount_value) || 0,
          discount_is_percentage: f.discount_is_percentage !== false,
        };`,
  ],
  [
    `            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>NEMIS</div><div style={{ fontWeight: 600 }}>{profile.nemisNumber || "—"}</div></div>
          </div>
        </Modal>`,
    `            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>NEMIS</div><div style={{ fontWeight: 600 }}>{profile.nemisNumber || "—"}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Opening balance</div><div style={{ fontWeight: 600 }}>{profile.opening_balance != null ? \`\${Number(profile.opening_balance).toLocaleString()} (\${profile.opening_balance_type || "owing"})\` : "—"}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Transport</div><div style={{ fontWeight: 600 }}>{profile.transport_direction && profile.transport_direction !== "none" ? \`\${profile.transport_direction} \u00b7 KES \${Number(profile.transport_base_fee || 0).toLocaleString()}\` : "None"}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Lunch</div><div style={{ fontWeight: 600 }}>{profile.lunch_enabled ? \`Yes \u00b7 \${profile.lunch_billing_type || "termly"}\` : "No"}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Breakfast</div><div style={{ fontWeight: 600 }}>{profile.breakfast_enabled ? "Yes" : "No"}</div></div>
          </div>
        </Modal>`,
  ],
]);

patch("backend/src/routes/students.routes.js", [
  [
    `    if (outstanding_balance !== undefined) updateData.outstanding_balance = parseFloat(outstanding_balance) || 0;
    if (transport_fee !== undefined) updateData.transport_fee = parseFloat(transport_fee) || 0;
    if (lunch_fee !== undefined) updateData.lunch_fee = parseFloat(lunch_fee) || 0;
    if (breakfast_termly_fee !== undefined) updateData.breakfast_termly_fee = parseFloat(breakfast_termly_fee) || 0;`,
    `    if (outstanding_balance !== undefined) updateData.outstanding_balance = parseFloat(outstanding_balance) || 0;
    // transport_fee / lunch_fee omitted — not present on all tenants (PostgREST schema cache 500)
    if (breakfast_termly_fee !== undefined) updateData.breakfast_termly_fee = parseFloat(breakfast_termly_fee) || 0;`,
  ],
]);

console.log("Done. Commit the changed files and deploy Vercel + Render.");
