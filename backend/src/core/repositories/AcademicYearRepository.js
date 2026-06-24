import { BaseRepository } from '../BaseRepository.js';

/**
 * Academic Year Repository
 * Manages academic year and term data access
 */
export class AcademicYearRepository extends BaseRepository {
  constructor() {
    super('academic_years');
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
    // Remove current flag from all academic years for this school
    await this.client
      .from(this.tableName)
      .update({ is_current: false })
      .eq('school_id', schoolId);
    
    // Set new current academic year
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_current: true })
      .eq('id', id)
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
      .eq('id', id)
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
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

/**
 * Term Repository
 * Manages term data access
 */
export class TermRepository extends BaseRepository {
  constructor() {
    super('terms');
  }

  /**
   * Find current term for a school
   */
  async findCurrent(schoolId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, academic_years(*)')
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
      .eq('academic_year_id', academicYearId)
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  /**
   * Set term as current
   */
  async setCurrent(id, schoolId) {
    // Remove current flag from all terms for this school
    await this.client
      .from(this.tableName)
      .update({ is_current: false })
      .eq('school_id', schoolId);
    
    // Set new current term
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_current: true })
      .eq('id', id)
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
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}
