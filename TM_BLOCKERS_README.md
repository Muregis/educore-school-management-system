# TM release blockers — apply instructions

**Do not merge this branch until `students.routes.js` is restored from main and patched.**

## Safe path (recommended)

```bash
git fetch origin
git checkout main
git pull
git checkout -b fix/tm-blockers-v2

# 1) Mobile KPI (Reports, Expenditures, finance)
node scripts/apply-mobile-kpi-fix.mjs

# 2) Backend blockers (fee util, public path session skip, GET /login 405)
# First ensure scripts exist (on main after merging apply scripts, or copy from this branch)
node scripts/apply-tm-backend-blockers.mjs

# 3) CI tests
git cherry-pick e0cfe2e9cac8fb2f417c54daac0eb3f41bfb399d || true
# Or ensure .github/workflows/ci.yml has backend "Run unit tests" step

git add -A
git status
git commit -m "fix: TM blockers — mobile KPI, fee util, auth contract, CI tests"
git push -u origin fix/tm-blockers-v2
```

## Verify

- Reports mobile: 2-column KPI grid, readable labels
- `grep buildStudentFeeUpdateData backend/src/routes/students.routes.js`
- `grep isPublicApiPath backend/src/app.js` (after apply-tm-backend)
- `grep AUTH_METHOD_NOT_ALLOWED backend/src/routes/auth.routes.js`
- CI runs `npm test` in backend job

## On this branch already

- CI: backend unit tests step
- `scripts/apply-tm-backend-blockers.mjs`
- `scripts/apply-mobile-kpi-fix.mjs` (on main)
- `auth.routes.js`: GET /login → 405
- `app.js`: restored from main (run apply-tm-backend for isPublicApiPath)
