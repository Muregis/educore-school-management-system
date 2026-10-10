# TM release blockers — branch status

## Backend: SAFE (placeholders removed)

- `students.routes.js` — full routes + `buildStudentFeeUpdateData` (no `lunch_fee` column writes)
- `app.js` — `isPublicApiPath` skips session/tenant on public routes
- `auth.routes.js` — GET `/login` → 405 `AUTH_METHOD_NOT_ALLOWED`
- CI — backend job runs `npm test`

## Frontend mobile KPI

If Reports still uses local StatCard `minWidth: 160px`, run from repo root:

```bash
node scripts/apply-mobile-kpi-fix.mjs
git add src/pages && git commit -m "fix(mobile): KPI grids on Reports and finance pages"
```

That patches Reports, Expenditures, and finance pages to use `.ec-kpi-grid`.

## Pre-merge check

```bash
# Must be empty
grep -r PLACEHOLDER backend/src --include='*.js' || echo OK

grep -n buildStudentFeeUpdateData backend/src/routes/students.routes.js
grep -n isPublicApiPath backend/src/app.js
grep -n AUTH_METHOD_NOT_ALLOWED backend/src/routes/auth.routes.js
```
