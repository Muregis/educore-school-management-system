# EduCore School Management System

Frontend: React + Vite
Backend: Node.js + Express + MySQL (in `/backend`)

## Quick Start

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend default URL: `http://localhost:4000`
Frontend default URL: `http://localhost:5173`

## Database
Run these in MySQL Workbench (already done on your side):
- `database/schema.sql`
- `database/seed.sql`

If your MySQL runs on port `3307`, keep `DB_PORT=3307` in `backend/.env`.
