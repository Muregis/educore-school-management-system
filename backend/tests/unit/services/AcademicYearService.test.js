/**
 * Unit Tests for Academic Year Service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AcademicYearService } from '../../../src/core/services/AcademicYearService.js';

describe('AcademicYearService', () => {
  let service;

  beforeEach(() => {
    service = new AcademicYearService();
  });

  it('should create service instance', () => {
    expect(service).toBeDefined();
  });

  it('should have createAcademicYear method', () => {
    expect(typeof service.createAcademicYear).toBe('function');
  });

  it('should validate date range - end date before start date', async () => {
    const data = {
      school_id: 1,
      name: '2024-2025',
      start_date: '2025-01-01',
      end_date: '2024-12-31'
    };

    await expect(service.createAcademicYear(data)).rejects.toThrow('End date must be after start date');
  });

  it('should validate date range - end date equals start date', async () => {
    const data = {
      school_id: 1,
      name: '2024-2025',
      start_date: '2025-01-01',
      end_date: '2025-01-01'
    };

    await expect(service.createAcademicYear(data)).rejects.toThrow('End date must be after start date');
  });

  it('should have getCurrent method', () => {
    expect(typeof service.getCurrent).toBe('function');
  });

  it('should have getAcademicYearWithTerms method', () => {
    expect(typeof service.getAcademicYearWithTerms).toBe('function');
  });
});
