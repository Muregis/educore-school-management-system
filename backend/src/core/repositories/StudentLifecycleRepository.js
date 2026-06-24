import { BaseRepository } from '../BaseRepository.js';

/**
 * Student Enrollment Repository
 * Manages student enrollment history
 */
export class StudentEnrollmentRepository extends BaseRepository {
  constructor() {
    super('student_enrollments');
  }

  /**
   * Find current enrollment for student
   */
  async findCurrent(studentId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, classes(*), streams(*)')
      .eq('student_id', studentId)
      .eq('enrollment_status', 'active')
      .is('exit_date', null)
      .order('enrollment_date', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Find enrollment history for student
   */
  async findHistory(studentId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, classes(*), streams(*), academic_years(*), terms(*)')
      .eq('student_id', studentId)
      .order('enrollment_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  /**
   * Find students by class and academic year
   */
  async findByClass(classId, academicYearId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, students(*)')
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId)
      .eq('enrollment_status', 'active');
    
    if (error) throw error;
    return data || [];
  }
}

/**
 * Student Status History Repository
 * Manages student status changes
 */
export class StudentStatusHistoryRepository extends BaseRepository {
  constructor() {
    super('student_status_history');
  }

  /**
   * Find status history for student
   */
  async findByStudent(studentId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}

/**
 * Alumni Repository
 * Manages alumni records
 */
export class AlumniRepository extends BaseRepository {
  constructor() {
    super('alumni');
  }

  /**
   * Find alumni by school
   */
  async findBySchool(schoolId, options = {}) {
    return await this.findAll({ school_id: schoolId }, options);
  }

  /**
   * Find alumni by graduation year
   */
  async findByGraduationYear(schoolId, year) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, students(*)')
      .eq('school_id', schoolId)
      .gte('graduation_date', `${year}-01-01`)
      .lte('graduation_date', `${year}-12-31`);
    
    if (error) throw error;
    return data || [];
  }
}
