import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../src/app.js';
import { env } from '../../../src/config/env.js';

describe('Onboarding API contracts', () => {
  describe('POST /api/onboarding/register-school', () => {
    it('validates required school name', async () => {
      const res = await request(app)
        .post('/api/onboarding/register-school')
        .send({
          directorName: 'Grace Wanjiku',
          email: 'grace@example.com',
          password: 'ValidPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/school name/i);
    });

    it('validates required director or admin name', async () => {
      const res = await request(app)
        .post('/api/onboarding/register-school')
        .send({
          schoolName: 'Moi Academy',
          email: 'admin@example.com',
          password: 'ValidPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/name is required/i);
    });

    it('validates valid email address', async () => {
      const res = await request(app)
        .post('/api/onboarding/register-school')
        .send({
          schoolName: 'Moi Academy',
          adminName: 'Grace Wanjiku',
          email: 'invalid-email-format',
          password: 'ValidPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/email is required/i);
    });

    it('validates strong password policy', async () => {
      const res = await request(app)
        .post('/api/onboarding/register-school')
        .send({
          schoolName: 'Moi Academy',
          adminName: 'Grace Wanjiku',
          email: 'grace@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/password/i);
    });
  });

  describe('GET /api/onboarding/status', () => {
    it('requires authentication (rejects 401/403 without token)', async () => {
      const res = await request(app).get('/api/onboarding/status');
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('POST /api/onboarding/complete', () => {
    it('requires authentication (rejects 401/403 without token)', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .send({ schoolType: 'primary', academicYear: 2026, defaultTuition: 5000 });

      expect([401, 403]).toContain(res.status);
    });

    it('rejects unauthorized roles (student/parent) with 403', async () => {
      const studentToken = jwt.sign(
        { user_id: 99, school_id: 1, role: 'student' },
        env.jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ schoolType: 'primary', academicYear: 2026, defaultTuition: 5000 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/only directors/i);
    });
  });
});
