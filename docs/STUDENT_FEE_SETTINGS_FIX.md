# Student fee settings fix

## Problem
1. Polish removed Transport / Lunch / Breakfast / Opening balance from the student Add/Edit modal (logic remained).
2. Save still sent `lunch_fee` / `transport_fee` → PostgREST **schema cache 500**.

## Already on main
- `src/components/StudentFeeSettingsBlock.jsx` (from PR #29)

## This branch
- `scripts/apply-student-fee-fixes.mjs` — wires the component, fixes PATCH payload, stops writing missing columns.

## Apply (one command)
```bash
git checkout fix/student-fees-v2
node scripts/apply-student-fee-fixes.mjs
git add src/pages/StudentsPage.jsx backend/src/routes/students.routes.js
git commit -m "fix(students): restore fee UI; omit lunch_fee/transport_fee"
git push
```
Then merge to `main` and deploy **Vercel** (frontend) + **Render** (backend).

## Do not merge
`fix/student-fee-settings-complete` — accidental placeholder overwrote `students.routes.js`. Ignore that branch.
