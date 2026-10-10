# CRITICAL: ReportsPage.jsx is a PLACEHOLDER on this branch

Do **not** merge until you run these commands locally (takes ~30 seconds):

```bash
git fetch origin
git checkout fix/tm-release-blockers
git pull

# 1) Restore full file from main (removes PLACEHOLDER)
git checkout main -- src/pages/ReportsPage.jsx

# 2) Apply mobile KPI fix (shared StatCard + ec-kpi-grid)
node scripts/apply-mobile-kpi-fix.mjs
# or, if that fails:
# node scripts/patch-reports-kpi.mjs

# 3) Verify
grep -n 'ec-kpi-grid\|PLACEHOLDER\|minWidth.*160' src/pages/ReportsPage.jsx
# Expect: ec-kpi-grid present, PLACEHOLDER absent, minWidth 160 absent

git add src/pages/ReportsPage.jsx
git commit -m "fix(mobile): Reports KPI grid — shared StatCard + ec-kpi-grid"
git push
```

## Already fixed on this branch

- `src/pages/ExpendituresPage.jsx` — `ec-kpi-grid` + shared StatCard
- Backend placeholders removed (students, app, auth)
- CI backend tests

## Why this happened

ReportsPage.jsx is ~94KB. Tool uploads of that size failed and left a stub. Your local `git checkout main --` + apply script is the safe fix.
