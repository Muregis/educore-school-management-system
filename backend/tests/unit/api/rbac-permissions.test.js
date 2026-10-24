import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../src/app.js';
import { env } from '../../../src/config/env.js';

describe('RBAC & Permission Boundaries Matrix', () => {
  const directorToken = jwt.sign(
    { user_id: 1, school_id: 101, role: 'director' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  const teacherToken = jwt.sign(
    { user_id: 2, school_id: 101, role: 'teacher' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { user_id: 3, school_id: 101, role: 'student' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  const parentToken = jwt.sign(
    { user_id: 4, school_id: 101, role: 'parent' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  describe('Route: POST /api/onboarding/complete', () => {
    it('allows director role past the role-check guard', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ schoolType: 'primary', academicYear: 2026, defaultTuition: 5000 });

      // May return 200 or 400, but must NOT be 403 Forbidden
      expect(res.status).not.toBe(403);
    });

    it('rejects teacher role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ schoolType: 'primary', academicYear: 2026, defaultTuition: 5000 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/only directors/i);
    });

    it('rejects student role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ schoolType: 'primary', academicYear: 2026, defaultTuition: 5000 });

      expect(res.status).toBe(403);
    });

    it('rejects parent role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ schoolType: 'primary', academicYear: 2026, defaultTuition: 5000 });

      expect(res.status).toBe(403);
    });
  });

  describe('Route: GET /api/admin-permissions/admins', () => {
    it('allows director role past the role-check guard', async () => {
      const res = await request(app)
        .get('/api/admin-permissions/admins')
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.status).not.toBe(403);
    });

    it('rejects teacher role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin-permissions/admins')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects student role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin-permissions/admins')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects parent role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin-permissions/admins')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Token Security & Edge Cases', () => {
    it('rejects expired JWT tokens with 401', async () => {
      const expiredToken = jwt.sign(
        { user_id: 1, school_id: 101, role: 'director' },
        env.jwtSecret,
        { expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it('rejects tokens signed with an invalid secret with 401', async () => {
      const rogueToken = jwt.sign(
        { user_id: 1, school_id: 101, role: 'director' },
        'wrong-secret-key-that-does-not-match',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${rogueToken}`);

      expect([401, 403]).toContain(res.status);
    });
  });
});
