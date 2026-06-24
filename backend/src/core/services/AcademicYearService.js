import { AcademicYearRepository, TermRepository } from '../repositories/AcademicYearRepository.js';

/**
 * Academic Year Service
 * Implements complete academic lifecycle management
 */
export class AcademicYearService {
  constructor() {
    this.academicYearRepository = new AcademicYearRepository();
    this.termRepository = new TermRepository();
  }

  /**
   * Create new academic year
   */
  async createAcademicYear(data, context = {}) {
    // Validate date range
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      throw new Error('End date must be after start date');
    }

    // Check for overlapping academic years
    const existing = await this.academicYearRepository.findAll({
      school_id: data.school_id,
      is_closed: false
    });

    const overlaps = existing.data?.find(year => 
      (new Date(data.start_date) >= new Date(year.start_date) && 
       new Date(data.start_date) <= new Date(year.end_date)) ||
      (new Date(data.end_date) >= new Date(year.start_date) && 
       new Date(data.end_date) <= new Date(year.end_date))
    );

    if (overlaps) {
      throw new Error('Academic year overlaps with existing year');
    }

    // If is_current is true, remove current flag from other years
    if (data.is_current) {
      await this.academicYearRepository.setCurrent(null, data.school_id);
    }

    return await this.academicYearRepository.create(data, context);
  }

  /**
   * Create new term
   */
  async createTerm(data, context = {}) {
    // Validate date range
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      throw new Error('End date must be after start date');
    }

    // Verify academic year exists
    const academicYear = await this.academicYearRepository.findById(data.academic_year_id);
    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    // Ensure term dates are within academic year dates
    if (new Date(data.start_date) < new Date(academicYear.start_date) ||
        new Date(data.end_date) > new Date(academicYear.end_date)) {
      throw new Error('Term dates must be within academic year dates');
    }

    // If is_current is true, remove current flag from other terms
    if (data.is_current) {
      await this.termRepository.setCurrent(null, data.school_id);
    }

    return await this.termRepository.create(data, context);
  }

  /**
   * Open academic year
   */
  async openAcademicYear(id, context = {}) {
    const academicYear = await this.academicYearRepository.findById(id);
    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    if (academicYear.is_closed) {
      throw new Error('Cannot open a closed academic year');
    }

    return await this.academicYearRepository.open(id);
  }

  /**
   * Close academic year
   */
  async closeAcademicYear(id, context = {}) {
    const academicYear = await this.academicYearRepository.findById(id);
    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    // Close all terms in this academic year
    const terms = await this.termRepository.findByAcademicYear(id);
    for (const term of terms) {
      await this.termRepository.close(term.id);
    }

    return await this.academicYearRepository.close(id);
  }

  /**
   * Set current academic year
   */
  async setCurrentAcademicYear(id, schoolId, context = {}) {
    const academicYear = await this.academicYearRepository.findById(id);
    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    if (academicYear.school_id !== schoolId) {
      throw new Error('Academic year does not belong to this school');
    }

    if (academicYear.is_closed) {
      throw new Error('Cannot set a closed academic year as current');
    }

    return await this.academicYearRepository.setCurrent(id, schoolId);
  }

  /**
   * Set current term
   */
  async setCurrentTerm(id, schoolId, context = {}) {
    const term = await this.termRepository.findById(id);
    if (!term) {
      throw new Error('Term not found');
    }

    if (term.school_id !== schoolId) {
      throw new Error('Term does not belong to this school');
    }

    if (term.is_closed) {
      throw new Error('Cannot set a closed term as current');
    }

    return await this.termRepository.setCurrent(id, schoolId);
  }

  /**
   * Get current academic year and term
   */
  async getCurrent(schoolId) {
    const academicYear = await this.academicYearRepository.findCurrent(schoolId);
    const term = await this.termRepository.findCurrent(schoolId);

    return {
      academicYear,
      term
    };
  }

  /**
   * Get academic year with terms
   */
  async getAcademicYearWithTerms(id) {
    const academicYear = await this.academicYearRepository.findById(id);
    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    const terms = await this.termRepository.findByAcademicYear(id);

    return {
      ...academicYear,
      terms
    };
  }

  /**
   * Promote students to next academic year
   */
  async promoteStudents(academicYearId, context = {}) {
    // This is a placeholder for the full promotion logic
    // Will be implemented in Phase 4: Student Lifecycle
    throw new Error('Promotion logic will be implemented in Phase 4');
  }
}
