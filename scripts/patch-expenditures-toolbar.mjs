#!/usr/bin/env node
/** Fix only: Expenditures filter toolbar wrongly used ec-kpi-grid. Does not touch Reports. */
import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/pages/ExpendituresPage.jsx");
let t = fs.readFileSync(p, "utf8");

if (t.includes("PLACEHOLDER")) {
  console.error("ExpendituresPage has PLACEHOLDER — abort");
  process.exit(1);
}

const old = `          <div className="ec-kpi-grid">
            <div style={{ minWidth: "220px" }}>
              <Input
                placeholder="Search item, payee, released by..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div style={{ minWidth: "200px" }}>
              <Select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                options={[
                  { value: "all", label: "All categories" },
                  ...EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
                ]}
              />
            </div>
          </div>`;

const neu = `          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <div style={{ minWidth: "min(100%, 220px)", flex: "1 1 180px" }}>
              <Input
                placeholder="Search item, payee, released by..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div style={{ minWidth: "min(100%, 200px)", flex: "1 1 160px" }}>
              <Select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                options={[
                  { value: "all", label: "All categories" },
                  ...EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
                ]}
              />
            </div>
          </div>`;

if (t.includes(old)) {
  t = t.replace(old, neu);
  console.log("ok: filter toolbar out of ec-kpi-grid");
} else if (t.includes('placeholder="Search item, payee, released by..."') && !t.match(/ec-kpi-grid[\s\S]{0,80}Search item/)) {
  console.log("no-op: filter already not in ec-kpi-grid");
} else {
  console.warn("WARN: filter pattern not found — check manually");
}

const old2 = 'gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)"';
const new2 = 'gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))"';
if (t.includes(old2)) {
  t = t.replace(old2, new2);
  console.log("ok: trend/categories grid responsive");
}

fs.writeFileSync(p, t);

const reports = fs.readFileSync(path.join(process.cwd(), "src/pages/ReportsPage.jsx"), "utf8");
if (reports.includes("PLACEHOLDER") || !reports.includes("ec-kpi-grid")) {
  console.error("SAFETY FAIL: ReportsPage broken — abort");
  process.exit(1);
}
const kpiCount = (t.match(/ec-kpi-grid/g) || []).length;
if (kpiCount !== 1) {
  console.warn("WARN: expected exactly 1 ec-kpi-grid in Expenditures, found", kpiCount);
}
console.log("wrote", p);
console.log("Expenditures ec-kpi-grid count:", kpiCount);
console.log("Reports still OK");
