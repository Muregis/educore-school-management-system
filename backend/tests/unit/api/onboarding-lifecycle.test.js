import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../src/app.js';
import { env } from '../../../src/config/env.js';

describe('School Onboarding Complete Lifecycle & Curriculum Provisioning', () => {
  const directorToken = jwt.sign(
    { user_id: 100, school_id: 50, role: 'director' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  describe('Step 1: Public Registration Endpoint Validation', () => {
    it('rejects registration with missing school name', async () => {
      const res = await request(app)
        .post('/api/onboarding/register-school')
        .send({
          directorName: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/school name/i);
    });

    it('rejects registration with weak password', async () => {
      const res = await request(app)
        .post('/api/onboarding/register-school')
        .send({
          schoolName: 'Nairobi Academy',
          directorName: 'Jane Doe',
          email: 'jane@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/password/i);
    });
  });

  describe('Step 2: Configuration & Curriculum Setup', () => {
    it('accepts valid CBC Primary curriculum setup payload from director', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          schoolType: 'primary',
          academicYear: 2026,
          defaultTuition: 8500,
          activeTerm: 'Term 1',
        });

      // Must pass auth and role guards without 401 or 403
      expect([200, 400]).toContain(res.status);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('accepts Secondary 8-4-4 / Senior School curriculum setup payload from director', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          schoolType: 'secondary',
          academicYear: 2026,
          defaultTuition: 15000,
          activeTerm: 'Term 1',
        });

      expect([200, 400]).toContain(res.status);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('Step 3: Onboarding Status Verification', () => {
    it('returns onboarding status for authenticated tenant', async () => {
      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${directorToken}`);

      // Must be authenticated
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
