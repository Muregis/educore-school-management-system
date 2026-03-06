# EduCore Backend (Quick Start)

## 1) Setup

```bash
cd backend
npm install
copy .env.example .env
```

Edit `.env` only if needed:
- `DB_PORT=3307` (matches your MySQL setup)
- `DB_NAME=educore_db`

## 2) Run

```bash
npm run start
```

Server: `http://localhost:4000`

## 3) Core auth

### Login
`POST /api/auth/login`

```json
{
  "email": "admin@greenfield.ac.ke",
  "password": "password123",
  "schoolId": 1
}
```

Use returned bearer token for protected routes.

---

## New Endpoints Added

### Communication
- `GET /api/communication/sms-logs`
- `POST /api/communication/sms-logs`
- `PATCH /api/communication/sms-logs/:id/status`

### Integrations
- `POST /api/integrations/mpesa/callback` (public callback)
- `POST /api/integrations/bank/reconcile` (admin/finance)
  - body with `rows` (JSON array) OR `csvText`.

### Discipline
- `GET /api/discipline`
- `POST /api/discipline` (admin/teacher)

### Transport
- `GET /api/transport/routes`
- `POST /api/transport/routes` (admin)
- `GET /api/transport/assignments`
- `POST /api/transport/assignments` (admin)

### Settings / Role Permissions
- `GET /api/settings/permissions` (admin)
- `PUT /api/settings/permissions` (admin)

### Payments
- `GET /api/payments`
- `POST /api/payments`
