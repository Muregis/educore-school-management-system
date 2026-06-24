/**
 * Unit Tests for Academic Year Repository
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AcademicYearRepository } from '../../../src/core/repositories/AcademicYearRepository.js';

describe('AcademicYearRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new AcademicYearRepository();
  });

  it('should create repository instance', () => {
    expect(repository).toBeDefined();
    expect(repository.tableName).toBe('academic_years');
  });

  it('should have findAll method', () => {
    expect(typeof repository.findAll).toBe('function');
  });

  it('should have findById method', () => {
    expect(typeof repository.findById).toBe('function');
  });

  it('should have create method', () => {
    expect(typeof repository.create).toBe('function');
  });

  it('should have update method', () => {
    expect(typeof repository.update).toBe('function');
  });

  it('should have findCurrent method', () => {
    expect(typeof repository.findCurrent).toBe('function');
  });

  it('should have setCurrent method', () => {
    expect(typeof repository.setCurrent).toBe('function');
  });
});
