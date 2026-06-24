/**
 * Integration Tests for Academic Years API
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Academic Years API', () => {
  let baseUrl;

  beforeAll(() => {
    baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  });

  it('GET /api/academic/current should return current academic year', async () => {
    const response = await fetch(`${baseUrl}/api/academic/current`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('success');
  });

  it('GET /api/academic/years should return list of academic years', async () => {
    const response = await fetch(`${baseUrl}/api/academic/years`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('success');
  });
});
