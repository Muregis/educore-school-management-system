import { BaseRepository } from '../BaseRepository.js';

/**
 * Exam Repository
 */
export class ExamRepository extends BaseRepository {
  constructor() {
    super('exams');
  }

  async findByAcademicYear(schoolId, academicYearId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .order('exam_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  async findBySubject(schoolId, subjectId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('school_id', schoolId)
      .eq('subject_id', subjectId)
      .order('exam_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}

/**
 * Exam Results Repository
 */
export class ExamResultsRepository extends BaseRepository {
  constructor() {
    super('exam_results');
  }

  async findByExam(examId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, students(*)')
      .eq('exam_id', examId)
      .order('marks', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async findByStudent(studentId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, exams(*), subjects(*)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async lockResult(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ locked: true })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}
