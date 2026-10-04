# EduCore — School Management SaaS

Multi-tenant **public SaaS** for schools: students, fees, attendance, exams, HR, multi-campus, payments (Paystack / M-Pesa), and parent portals.

| Layer | Stack |
|-------|--------|
| Frontend | React + Vite (Vercel) |
| API | Node.js + Express (Render) |
| Data | Supabase (PostgreSQL + Storage) |

Production app: [educore-school-management-system-pi.vercel.app](https://educore-school-management-system-pi.vercel.app/)

---

## SaaS reliability

| Topic | Document |
|-------|----------|
| **Uptime SLA** (99.5% Standard) | [docs/SLA.md](docs/SLA.md) |
| **Backups & DR** (RPO ≤ 24h, 7-day retention) | [docs/BACKUP_POLICY.md](docs/BACKUP_POLICY.md) |
| **Status probes & monitoring** | [docs/STATUS_AND_UPTIME.md](docs/STATUS_AND_UPTIME.md) |

### Health endpoints (no auth)

```
GET  /api/health/live     → process up
GET  /api/health/ready    → database reachable (SLA probe)
GET  /api/health/status   → public overall status JSON
POST /api/health/cron/backups  → daily backups (Bearer CRON_SECRET)
```

Point uptime monitors at **`/api/health/ready`**.  
Schedule daily backups with **`CRON_SECRET`** (see backup policy).

---

## Quick start (developers)

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend default: `http://localhost:4000`  
Frontend default: `http://localhost:5173`

### Database
Apply SQL under `database/` (schema + migrations) on your Supabase/Postgres project.

---

## Security notes

- Tenant isolation by `school_id`; backup objects live under `school_{id}/` prefixes.
- Logical dumps **exclude** password hashes and other secrets (see `backup.service.js`).
- Never commit production secrets; use host env / Render sync:false vars.
