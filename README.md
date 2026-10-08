# EduCore — School Management SaaS

Multi-tenant school management system: students, fees, attendance, exams, multi-campus support, payments (Paystack / M-Pesa hooks), and parent-facing flows.

| Layer | Stack |
|-------|--------|
| Frontend | React + Vite (Vercel) |
| API | Node.js + Express (Render) |
| Data | Supabase (PostgreSQL + Storage) |

**Live app:** [educore-school-management-system-pi.vercel.app](https://educore-school-management-system-pi.vercel.app/)

## Reliability notes

| Topic | Document |
|-------|----------|
| Uptime / SLA framing | `docs/SLA.md` (if present) |
| Backups | `docs/BACKUP_POLICY.md` (if present) |
| Health probes | `GET /api/health/live`, `/api/health/ready`, `/api/health/status` |

## Quick start

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
cp .env.example .env   # never commit real secrets
npm run dev
```

Backend default: `http://localhost:4000`  
Frontend default: `http://localhost:5173`

Apply SQL under `database/` on your Postgres/Supabase project.

## Security

- Tenant isolation is keyed by `school_id`.
- **Do not commit `.env`, `.env.production`, or `.env.render`.** Use host env vars (Vercel / Render) only.
- If any secrets were ever committed historically, **rotate them** (JWT, Supabase service role, payment keys, M-Pesa, Groq, etc.) even after the files are removed from the tree.

## Status

Active product development. Prefer reading implementation + security reports in-repo over marketing claims in older notes.
