import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app.js';

describe('Academic Years API contracts', () => {
  it('GET /api/academic/years requires authentication', async () => {
    const response = await request(app).get('/api/academic/years');
    expect([401, 403]).toContain(response.status);
  });

  it('GET /api/academic/years/current requires authentication', async () => {
    const response = await request(app).get('/api/academic/years/current');
    expect([401, 403]).toContain(response.status);
  });

  it('POST /api/academic/years requires authentication', async () => {
    const response = await request(app)
      .post('/api/academic/years')
      .send({ name: '2026', start_date: '2026-01-01', end_date: '2026-12-31' });
    expect([401, 403]).toContain(response.status);
  });
});

