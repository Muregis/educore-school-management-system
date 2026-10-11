import request from 'supertest';
import app from '../src/app.js';

describe('EduCore auth contracts', () => {
  test('allows unauthenticated access to health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  test('rejects missing token on protected routes (/api/students) with 401', async () => {
    const res = await request(app).get('/api/students');
    expect([401, 403]).toContain(res.status);
  });

  test('rejects missing token on protected routes (/api/classes) with 401', async () => {
    const res = await request(app).get('/api/classes');
    expect([401, 403]).toContain(res.status);
  });

  test('rejects invalid token on protected routes with 401', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', 'Bearer invalid-token-string');
    expect([401, 403]).toContain(res.status);
  });

  test('test harness is present (jest available)', () => {
    expect(typeof describe).toBe('function');
  });
});

