import { BaseRepository } from '../BaseRepository.js';

/**
 * Academic Year Repository
 * Manages academic year data access
 */
export class AcademicYearRepository extends BaseRepository {
  constructor() {
    super('academic_years');
  }

  /**
   * Find single record by ID
   * Overrides BaseRepository to use academic_year_id as PK
   */
  async findById(id, options = {}) {
    const { select = '*' } = options;
    
    const { data, error } = await this.client
      .from(this.tableName)
      .select(select)
      .eq('academic_year_id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Find current academic year for a school
   */
  async findCurrent(schoolId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Set academic year as current
   */
  async setCurrent(id, schoolId) {
    await this.client
      .from(this.tableName)
      .update({ is_current: false })
      .eq('school_id', schoolId);
    
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_current: true })
      .eq('academic_year_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Close academic year
   */
  async close(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_closed: true, is_current: false })
      .eq('academic_year_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Open academic year
   */
  async open(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_closed: false })
      .eq('academic_year_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

/**
 * Term Repository
 * Manages academic term data access
 */
export class TermRepository extends BaseRepository {
  constructor() {
    super('academic_terms');
  }

  /**
   * Find single record by ID
   * Overrides BaseRepository to use term_id as PK
   */
  async findById(id, options = {}) {
    const { select = '*' } = options;
    
    const { data, error } = await this.client
      .from(this.tableName)
      .select(select)
      .eq('term_id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Find current term for a school
   */
  async findCurrent(schoolId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, academic_years!inner(year_label)')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Find terms by academic year
   */
  async findByAcademicYear(academicYearId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('academic_year', academicYearId)
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  /**
   * Set term as current
   */
  async setCurrent(id, schoolId) {
    await this.client
      .from(this.tableName)
      .update({ is_current: false })
      .eq('school_id', schoolId);
    
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_current: true })
      .eq('term_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Close term
   */
  async close(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_closed: true, is_current: false })
      .eq('term_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}
