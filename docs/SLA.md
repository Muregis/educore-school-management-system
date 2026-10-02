# EduCore Service Level Agreement (SLA)

**Product:** EduCore School Management System (multi-tenant SaaS)  
**Audience:** Paying school tenants and platform operators  
**Effective:** upon production deployment of this document's revision  

This SLA describes availability targets, how downtime is measured, and what happens when targets are missed. It is written for a **general public SaaS** offering—not a single-school install.

---

## 1. Service description

EduCore provides hosted school management (students, fees, attendance, exams, HR, multi-campus) as a multi-tenant cloud service. Each school is an isolated tenant. The service comprises:

| Component | Typical host | Role |
|-----------|----------------|------|
| Web application | Vercel (or equivalent CDN/edge) | UI |
| API | Render / Node host | Business logic |
| Primary database | Supabase (PostgreSQL) | Tenant data |
| Object storage | Supabase Storage | Backups, uploads |
| Payments / SMS | Paystack, M-Pesa, WhatsApp providers | Optional integrations |

---

## 2. Availability target

| Tier | Monthly uptime target | Allowed downtime / 30-day month |
|------|----------------------|----------------------------------|
| **Standard (default)** | **99.5%** | ≤ 3 hours 36 minutes |
| **Business** (optional) | **99.9%** | ≤ 43 minutes |

Uptime is measured on the **API readiness signal** (`GET /api/health/ready` returning HTTP 200) and the **public status endpoint** (`GET /api/health/status`), polled at least once per minute by an external monitor.

### 2.1 What counts as downtime

- API `/api/health/ready` returns **5xx** or does not respond within **10 seconds** for a continuous period of **≥ 5 minutes**.
- Complete inability for authenticated tenants to reach the login API for the same continuous period.

### 2.2 What does **not** count as downtime

- Scheduled maintenance announced **≥ 48 hours** in advance (max 4 hours per calendar month unless emergency).
- Failures of third-party networks (ISP, mobile data), the school’s devices, or payment/SMS provider outages outside EduCore’s control.
- Issues limited to a single tenant caused by that tenant’s configuration or data.
- Force majeure (regional power/network catastrophe, upstream cloud region failure after reasonable failover attempts).

---

## 3. Support response (production)

| Severity | Meaning | First response target |
|----------|---------|------------------------|
| **P1** | Service unavailable for multiple tenants | 1 hour |
| **P2** | Major feature broken (e.g. fees/payments) | 4 hours |
| **P3** | Degraded or single-tenant issue | 1 business day |
| **P4** | Cosmetic / question | 2 business days |

Business hours default: **Mon–Fri 08:00–18:00 East Africa Time**, unless a higher support tier is contracted.

---

## 4. Service credits (optional commercial term)

If monthly uptime falls below the committed target for a paying tenant:

| Monthly uptime | Credit (% of that month’s subscription) |
|----------------|----------------------------------------|
| 99.0% – below target | 10% |
| 95.0% – below 99.0% | 25% |
| below 95.0% | 50% |

Credits apply to future invoices only, require written claim within 30 days of month end, and are the sole remedy for availability shortfalls under this SLA.

---

## 5. Data protection commitments (summary)

- Tenant data is isolated by `school_id` (application + storage path isolation).
- Automated **daily** logical backups per tenant (see BACKUP_POLICY.md).
- **RPO (Recovery Point Objective):** ≤ 24 hours for Standard; target ≤ 4 hours for Business when continuous backup/PITR is enabled on the database plan.
- **RTO (Recovery Time Objective):** ≤ 8 hours for Standard platform restore; best-effort faster for single-tenant restore from object-storage backup.

---

## 6. Status communication

- Public machine-readable status: `GET /api/health/status`
- Liveness (process up): `GET /api/health/live`
- Readiness (DB reachable): `GET /api/health/ready`
- Operators should publish a status page URL that consumes `/api/health/status`.

---

## 7. Changes

EduCore may update this SLA with **30 days’ notice** to subscribed tenants for material reductions in commitment. Improvements may take effect immediately.
