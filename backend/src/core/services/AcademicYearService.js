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
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      throw new Error('End date must be after start date');
    }

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

    const isCurrent = Boolean(data.is_current);

    if (isCurrent) {
      await this.academicYearRepository.setCurrent(null, data.school_id);
      const createData = { ...data, is_current: true };
      delete createData.is_current;
      return await this.academicYearRepository.create(createData, context);
    }

    return await this.academicYearRepository.create(data, context);
  }

  /**
   * Create new term
   */
  async createTerm(data, context = {}) {
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      throw new Error('End date must be after start date');
    }

    const academicYear = await this.academicYearRepository.findById(data.academic_year_id);
    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    if (new Date(data.start_date) < new Date(academicYear.start_date) ||
        new Date(data.end_date) > new Date(academicYear.end_date)) {
      throw new Error('Term dates must be within academic year dates');
    }

    const isCurrent = Boolean(data.is_current);

    if (isCurrent) {
      await this.termRepository.setCurrent(null, data.school_id);
      const createData = { ...data, is_current: true };
      delete createData.is_current;
      return await this.termRepository.create(createData, context);
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

    const yearLabel = academicYear.academic_year || academicYear.year_label;
    const terms = await this.termRepository.findByAcademicYear(yearLabel);
    for (const term of terms) {
      await this.termRepository.close(term.term_id);
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

    if (term.status === 'closed' || term.status === 'locked') {
      throw new Error('Cannot set a closed or locked term as current');
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

    const yearLabel = academicYear.academic_year || academicYear.year_label;
    const terms = await this.termRepository.findByAcademicYear(yearLabel);

    return {
      ...academicYear,
      terms
    };
  }

  /**
   * Promote students to next academic year
   */
  async promoteStudents(academicYearId, context = {}) {
    throw new Error('Promotion logic will be implemented in Phase 4');
  }
}
