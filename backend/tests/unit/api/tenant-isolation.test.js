import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../src/app.js';
import { env } from '../../../src/config/env.js';
import { withTenantFilter } from '../../../src/config/supabaseClient.js';

describe('Tenant Isolation & Multi-Tenant Boundary Enforcement', () => {
  const schoolA_director = jwt.sign(
    { user_id: 10, school_id: 101, role: 'director' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  const schoolB_director = jwt.sign(
    { user_id: 20, school_id: 202, role: 'director' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  describe('Query Parameter & Body Parameter Cross-Tenant Tampering Resistance', () => {
    it('actively detects cross-tenant query parameter tampering and blocks with 403', async () => {
      // School A user attempts to fetch or manipulate School B (202) classes via query parameter
      const res = await request(app)
        .get('/api/classes?school_id=202')
        .set('Authorization', `Bearer ${schoolA_director}`);

      // The tenantContext middleware detects cross-tenant tampering and blocks with 403
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/unauthorized tenant access/i);
    });

    it('actively detects cross-tenant body tampering and blocks with 403', async () => {
      // School A user attempts to mutate resources for School B (202) via body payload
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${schoolA_director}`)
        .send({
          school_id: 202,
          first_name: 'Attacker',
          last_name: 'Student',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/unauthorized tenant access/i);
    });
  });

  describe('Database Query Builder Tenant Isolation', () => {
    it('withTenantFilter helper strictly binds queries to target school_id', () => {
      const mockQuery = {
        filterField: null,
        filterValue: null,
        eq(field, value) {
          this.filterField = field;
          this.filterValue = value;
          return this;
        }
      };

      const scoped = withTenantFilter(mockQuery, 101);
      expect(scoped.filterField).toBe('school_id');
      expect(scoped.filterValue).toBe(101);
    });

    it('prevents cross-tenant query contamination between two instances', () => {
      const queryA = {
        eq(field, value) {
          this.applied = { field, value };
          return this;
        }
      };
      const queryB = {
        eq(field, value) {
          this.applied = { field, value };
          return this;
        }
      };

      withTenantFilter(queryA, 101);
      withTenantFilter(queryB, 202);

      expect(queryA.applied.value).toBe(101);
      expect(queryB.applied.value).toBe(202);
      expect(queryA.applied.value).not.toBe(queryB.applied.value);
    });
  });
});
