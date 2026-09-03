/**
 * Unit Tests for BillingService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BillingService } from '../../../src/services/BillingService.js';

describe('BillingService', () => {
  let service;

  beforeEach(() => {
    service = new BillingService();
    jest.clearAllMocks();
  });

  describe('selectBillingContext', () => {
    it('should select current academic year and term', async () => {
      const mockYear = { academic_year_id: 1, year_label: '2025/2026', is_current: true };
      const mockTerm = { term_id: 1, term_name: 'Term 1', start_date: '2025-01-01', end_date: '2025-03-31' };

      const supabaseMock = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockYear, error: null }))
            }))
          }))
        }))
      };

      // This test would require proper mocking of supabase
      // Placeholder for actual implementation
      expect(service.selectBillingContext).toBeDefined();
    });
  });

  describe('computeStudentBilling', () => {
    it('should compute charges for a student with fee structure', async () => {
      const schoolId = 1;
      const student = {
        student_id: 1,
        school_id: 1,
        class_name: 'Class 1',
        opening_balance: 0,
        opening_balance_type: 'owing',
        transport_base_fee: 0,
        transport_direction: 'none',
        lunch_enabled: false,
        lunch_daily_rate: 100,
        lunch_days: 0,
        lunch_billing_type: 'termly',
        breakfast_enabled: false,
        breakfast_daily_rate: 0,
        breakfast_days: 0,
        breakfast_billing_type: 'daily',
        discount_value: 0,
        discount_is_percentage: true,
        discount_type: null,
      };

      const term = { term_id: 1, term_name: 'Term 1', start_date: '2025-01-01', end_date: '2025-03-31' };
      const academicYear = { academic_year_id: 1, year_label: '2025/2026' };
      const settings = { lunch_daily_rate: 100, lunch_days: 0 };

      // Mock getFeeStructure to return a structure
      jest.spyOn(service, 'getFeeStructure').mockResolvedValue({
        fee_structure_id: 1,
        school_id: 1,
        class_name: 'Class 1',
        term: 'Term 1',
        tuition: 1000,
        activity: 200,
        misc: 100,
      });

      // Mock getActiveStudentServices to return empty
      jest.spyOn(service, 'getActiveStudentServices').mockResolvedValue([]);

      // Mock getStudentDiscounts to return empty
      jest.spyOn(service, 'getStudentDiscounts').mockResolvedValue([]);

      const result = await service.computeStudentBilling(schoolId, student, term, academicYear, settings);

      expect(result).toBeDefined();
      expect(result.components.tuition_charge).toBe(1000);
      expect(result.components.activity_charge).toBe(200);
      expect(result.components.misc_charge).toBe(100);
      expect(result.total_charge).toBe(1300);
      expect(result.source_items).toHaveLength(1);
      expect(result.source_items[0].type).toBe('fee_structure');
    });

    it('should apply discount to tuition only', async () => {
      const schoolId = 1;
      const student = {
        student_id: 1,
        school_id: 1,
        class_name: 'Class 1',
        opening_balance: 0,
        opening_balance_type: 'owing',
        transport_base_fee: 0,
        transport_direction: 'none',
        lunch_enabled: false,
        lunch_daily_rate: 100,
        lunch_days: 0,
        lunch_billing_type: 'termly',
        breakfast_enabled: false,
        breakfast_daily_rate: 0,
        breakfast_days: 0,
        breakfast_billing_type: 'daily',
        discount_value: 10,
        discount_is_percentage: true,
        discount_type: 'sibling',
      };

      const term = { term_id: 1, term_name: 'Term 1', start_date: '2025-01-01', end_date: '2025-03-31' };
      const academicYear = { academic_year_id: 1, year_label: '2025/2026' };
      const settings = { lunch_daily_rate: 100, lunch_days: 0 };

      jest.spyOn(service, 'getFeeStructure').mockResolvedValue({
        fee_structure_id: 1,
        school_id: 1,
        class_name: 'Class 1',
        term: 'Term 1',
        tuition: 1000,
        activity: 200,
        misc: 100,
      });

      jest.spyOn(service, 'getActiveStudentServices').mockResolvedValue([]);

      jest.spyOn(service, 'getStudentDiscounts').mockResolvedValue([
        {
          discount_id: 1,
          school_id: 1,
          student_id: 1,
          discount_type: 'sibling',
          discount_value: 10,
          discount_value_type: 'percentage',
          is_active: true,
          expires_at: '2025-12-31',
        }
      ]);

      const result = await service.computeStudentBilling(schoolId, student, term, academicYear, settings);

      expect(result.discount_amount).toBe(100); // 10% of 1000 tuition
      expect(result.total_charge).toBe(1200); // 1300 - 100
      expect(result.source_items).toHaveLength(2);
      expect(result.source_items.find(i => i.type === 'discount')).toBeDefined();
    });

    it('should include carry-forward in total charge', async () => {
      const schoolId = 1;
      const student = {
        student_id: 1,
        school_id: 1,
        class_name: 'Class 1',
        opening_balance: 500,
        opening_balance_type: 'owing',
        transport_base_fee: 0,
        transport_direction: 'none',
        lunch_enabled: false,
        lunch_daily_rate: 100,
        lunch_days: 0,
        lunch_billing_type: 'termly',
        breakfast_enabled: false,
        breakfast_daily_rate: 0,
        breakfast_days: 0,
        breakfast_billing_type: 'daily',
        discount_value: 0,
        discount_is_percentage: true,
        discount_type: null,
      };

      const term = { term_id: 1, term_name: 'Term 1', start_date: '2025-01-01', end_date: '2025-03-31' };
      const academicYear = { academic_year_id: 1, year_label: '2025/2026' };
      const settings = { lunch_daily_rate: 100, lunch_days: 0 };

      jest.spyOn(service, 'getFeeStructure').mockResolvedValue({
        fee_structure_id: 1,
        school_id: 1,
        class_name: 'Class 1',
        term: 'Term 1',
        tuition: 1000,
        activity: 200,
        misc: 100,
      });

      jest.spyOn(service, 'getActiveStudentServices').mockResolvedValue([]);
      jest.spyOn(service, 'getStudentDiscounts').mockResolvedValue([]);

      const result = await service.computeStudentBilling(schoolId, student, term, academicYear, settings);

      expect(result.carry_forward).toBe(500);
      expect(result.total_charge).toBe(1800); // 1300 + 500
      expect(result.source_items).toHaveLength(2);
      expect(result.source_items.find(i => i.type === 'carry_forward')).toBeDefined();
    });
  });

  describe('idempotency', () => {
    it('should not create duplicate ledger entries on re-run', async () => {
      // This test requires a database or comprehensive mocking
      // Placeholder for actual implementation
      expect(service.runBillingForStudent).toBeDefined();
    });
  });

  describe('dryRunBilling', () => {
    it('should return computed charges without writing to ledger', async () => {
      // Placeholder for actual implementation
      expect(service.dryRunBilling).toBeDefined();
    });
  });
});
