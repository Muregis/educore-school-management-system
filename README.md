# EduCore

Multi-tenant school management SaaS for Kenyan schools: students, fees, attendance, academics, multi-campus ops, and payment integrations (Paystack / M-Pesa).

**Live:** [educore-school-management-system-pi.vercel.app](https://educore-school-management-system-pi.vercel.app/)

## Problem

Schools need one system for enrollment, fee collection, academics, and parent communication — often across campuses — without leaking one school’s data into another. Spreadsheet workflows and single-tenant tools do not scale cleanly to multi-school SaaS.

## Solution

EduCore provides:

- Multi-tenant tenancy keyed by `school_id`
- RBAC for school staff roles
- Fees, billing, expenditures, and payment gateway hooks
- Academic and operational modules (attendance, exams, etc.)
- Parent-facing flows where enabled
- Health/readiness endpoints for ops monitoring

Companion product: **[EduCore Ratiba](https://github.com/Muregis/Educore-Ratiba)** for whole-school timetable generation (CBC / 8-4-4, offline-capable).

## Architecture

```
React + Vite (Vercel)  ──REST──▶  Node/Express (Render)
                                        │
                                        ▼
                              Supabase PostgreSQL + Storage
```

| Layer | Stack |
|-------|--------|
| Frontend | React, Vite |
| API | Node.js, Express |
| Data | Supabase (PostgreSQL + Storage) |
| Auth / tenancy | JWT-style sessions + `school_id` isolation |
| Payments | Paystack / M-Pesa integration points |

## Key engineering decisions

1. **Tenant isolation by `school_id`** — every school-scoped query and storage path is tenant-aware; security reports in-repo document verification and fixes.
2. **Postgres via Supabase** — relational academic/fee data, storage for uploads, managed ops.
3. **Separate deploy units** — frontend on Vercel, API on Render, so each can scale and fail independently.
4. **Operational endpoints** — `/api/health/live`, `/api/health/ready`, `/api/health/status` for uptime probes.

See also: `SAAS_TENANT_SECURITY_REPORT.md`, `TENANT_ISOLATION_SECURITY_REPORT.md`, `SECURITY_FIXES_SUMMARY.md`.

## Security

- Never commit real `.env` / production env files — use Vercel & Render environment variables.
- If secrets were ever committed in history, **rotate** JWT secrets, Supabase service role keys, payment keys, and third-party API keys.
- Prefer least-privilege DB roles and HTTPS everywhere in production.

## Testing & CI

GitHub Actions (`.github/workflows/ci.yml`) runs on PRs to `main`:

- Frontend: `npm ci` + `npm run build`
- Backend: dependency install

Expand toward integration tests for auth, tenant isolation, and fee posting (see `PHASE15_TESTING.md`).

## Quick start

```bash
# Frontend
npm install && npm run dev          # :5173

# Backend
cd backend
npm install
cp .env.example .env                # never commit secrets
npm run dev                         # :4000
```

Apply SQL under `database/` on your Supabase/Postgres project.

## Status

Active product development. Flagship portfolio system — strongest evidence of multi-tenant SaaS and Kenyan education-domain engineering.

## License

Proprietary / project terms as stated in-repo.

---

Built by **Victor Muregi** · MuregiScore Technologies
