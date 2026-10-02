# EduCore Formal Backup & Disaster Recovery Policy

**Scope:** Production multi-tenant SaaS  
**Related code:** `backend/src/services/backup.service.js`, admin backups API, migration `078_backup_disaster_recovery.sql`

---

## 1. Objectives

| Metric | Standard SaaS | Notes |
|--------|---------------|--------|
| **RPO** | ≤ 24 hours | Daily tenant logical dump + platform DB backups |
| **RTO** | ≤ 8 hours | Time to restore a tenant or platform to last good backup |
| **Retention** | **7 daily** tenant dumps in object storage | Configurable `KEEP_LAST` |
| **Offsite** | Supabase Storage (separate from app disk) | Not on the API container filesystem |
| **Encryption in transit** | TLS | All API and storage access |
| **Secrets in dumps** | **Excluded** | Password hashes, 2FA secrets, API keys stripped |

---

## 2. Backup types

### 2.1 Tenant logical backups (application-controlled)

- **What:** Per-school export of tenant-scoped tables.
- **Where:** Private bucket `backups`, path `school_{id}/backup_school{id}_{timestamp}.sql`.
- **When:**
  - **Automated:** once per day via secure cron (`POST /api/health/cron/backups` with `CRON_SECRET`).
  - **Manual:** school admin/director via Admin → DB Backups.
- **Rotation:** keep last **7** successful files per school; older objects deleted.
- **Isolation:** one school cannot list/download another school’s prefix.

### 2.2 Platform database backups (infrastructure)

- **What:** Full PostgreSQL backup / point-in-time recovery as offered by the database provider (e.g. Supabase Pro PITR).
- **Owner:** Platform operator (not individual schools).
- **Recommendation for public SaaS:** enable provider **PITR** when offering 99.9% Business tier.

### 2.3 Application & config

- Source in GitHub.
- Production secrets only in host env / secret manager—never in the backups bucket.

---

## 3. Scheduling (production)

Do **not** rely only on `setTimeout` inside the Node process (sleeping free tiers miss midnight jobs).

**Required production pattern:**

1. Set env `CRON_SECRET` to a long random value.
2. Configure an external scheduler (Render Cron Job, GitHub Actions, or cron-job.org) daily, e.g. `02:00 EAT`:

```http
POST https://<api-host>/api/health/cron/backups
Authorization: Bearer <CRON_SECRET>
```

3. Monitor job success (HTTP 200 + body `ok: true`) with the same uptime tool used for SLA.

---

## 4. Verification

| Check | Frequency | How |
|-------|-----------|-----|
| Job ran | Daily | Cron monitor / logs `[backup] Uploaded` |
| File non-empty | Each run | Service rejects dumps under 100 bytes |
| Restore drill | **Quarterly** | Restore one non-production school into a staging DB |
| Access control | Continuous | Tenant path prefix + session school_id |

---

## 5. Restore procedure (tenant)

1. Identify school_id and backup filename (Admin → DB Backups or storage list).
2. Download via authorized admin API only.
3. Restore into a **staging** database first; verify row counts and login.
4. For production tenant restore: maintenance window, announce to school, apply, verify, reopen.
5. Record restore (school, backup id, operator, result).

**Never** restore one school’s dump into another school’s schema without explicit data-migration controls.

---

## 6. Disaster recovery tiers

| Scenario | Response |
|----------|----------|
| Single tenant data loss | Restore from that tenant’s object-storage backup |
| API host failure | Redeploy from Git; health checks gate traffic |
| Primary DB failure | Provider restore / PITR; then verify `/api/health/ready` |
| Region loss | Redeploy to alternate region + restore DB from offsite backup |

---

## 7. Responsibilities

| Role | Duty |
|------|------|
| Platform operator | Cron secret, monitors, provider DB backups, quarterly restore drill |
| School admin | Optional manual backup before bulk imports; keep contact emails current |
| EduCore engineering | Maintain strip-list for sensitive columns; tenant path isolation |

---

## 8. Public SaaS statement (customer-facing summary)

> EduCore performs **daily backups** of each school’s data to isolated cloud storage, retains **seven days** of school-level backups, and targets **no more than 24 hours** of data loss (RPO) and **eight hours** to restore service (RTO) under the Standard plan. Higher tiers may include point-in-time database recovery.
