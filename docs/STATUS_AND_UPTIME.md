# Status, uptime monitoring & public SaaS health

## Endpoints (no auth)

| Path | Purpose | Success |
|------|---------|---------|
| `GET /api/health/live` | Process is up (liveness) | `200` `{ "status": "ok" }` |
| `GET /api/health/ready` | DB reachable (readiness) | `200` `{ "status": "ready" }` |
| `GET /api/health/status` | **Public SaaS status** (safe summary) | `200` overall `operational` / `degraded` / `outage` |
| `GET /api/health` | Detailed operator view | May include service flags |

Use **`/ready`** for load balancer and SLA probes.  
Use **`/status`** for a public status page.

## External monitoring (required for SLA)

Configure any one of: UptimeRobot, Better Stack, Healthchecks.io, or Render native health checks.

**Probe:** `GET https://<api-host>/api/health/ready` every **60s**, alert after **2–3 failures**.  
Optional second probe: frontend origin homepage.

## Cron for backups

```
POST /api/health/cron/backups
Authorization: Bearer $CRON_SECRET
```

Returns `{ "ok": true, ... }` on success.

## Render / host health

Point the host’s health check path to `/api/health/ready` so bad deploys are not trafficked.
