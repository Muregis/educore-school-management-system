import { ExamRepository, ExamResultsRepository } from '../repositories/ExamRepository.js';

/**
 * Exam Service
 * Implements enterprise examination management
 */
export class ExamService {
  constructor() {
    this.examRepository = new ExamRepository();
    this.examResultsRepository = new ExamResultsRepository();
  }

  /**
   * Create exam with scheduling
   */
  async createExam(data, context = {}) {
    return await this.examRepository.create(data, context);
  }

  /**
   * Record exam result
   */
  async recordResult(data, context = {}) {
    // Check if result already exists and is locked
    const existing = await this.examResultsRepository.findByField('student_id', data.student_id);
    const locked = existing?.find(r => r.exam_id === data.exam_id && r.locked);
    
    if (locked) {
      throw new Error('Result is locked and cannot be modified');
    }

    return await this.examResultsRepository.create(data, context);
  }

  /**
   * Bulk record exam results
   */
  async bulkRecordResults(results, context = {}) {
    const created = [];
    for (const result of results) {
      try {
        const createdResult = await this.recordResult(result, context);
        created.push(createdResult);
      } catch (error) {
        // Continue with other results even if one fails
        console.error(`Failed to record result for student ${result.student_id}:`, error.message);
      }
    }
    return created;
  }

  /**
   * Lock exam results
   */
  async lockExamResults(examId, context = {}) {
    const results = await this.examResultsRepository.findByExam(examId);
    const locked = [];
    
    for (const result of results) {
      const lockedResult = await this.examResultsRepository.lockResult(result.id);
      locked.push(lockedResult);
    }
    
    return locked;
  }

  /**
   * Get exam statistics
   */
  async getExamStatistics(examId) {
    const results = await this.examResultsRepository.findByExam(examId);
    
    if (results.length === 0) {
      return {
        total_students: 0,
        average_marks: 0,
        highest_marks: 0,
        lowest_marks: 0,
        pass_count: 0,
        fail_count: 0
      };
    }

    const marks = results.map(r => r.marks);
    const average = marks.reduce((sum, m) => sum + m, 0) / marks.length;
    const highest = Math.max(...marks);
    const lowest = Math.min(...marks);
    const passCount = marks.filter(m => m >= 50).length;
    const failCount = marks.length - passCount;

    return {
      total_students: results.length,
      average_marks: Math.round(average * 100) / 100,
      highest_marks: highest,
      lowest_marks: lowest,
      pass_count: passCount,
      fail_count: failCount,
      pass_rate: Math.round((passCount / results.length) * 100)
    };
  }

  /**
   * Get student exam performance
   */
  async getStudentPerformance(studentId, academicYearId) {
    const results = await this.examResultsRepository.findByStudent(studentId);
    
    // Filter by academic year if provided
    const filtered = academicYearId 
      ? results.filter(r => r.exam?.academic_year_id === academicYearId)
      : results;

    const performance = filtered.map(r => ({
      exam: r.exam,
      subject: r.subject,
      marks: r.marks,
      grade: r.grade,
      remarks: r.remarks
    }));

    const average = performance.length > 0
      ? performance.reduce((sum, p) => sum + p.marks, 0) / performance.length
      : 0;

    return {
      results: performance,
      average_marks: Math.round(average * 100) / 100,
      total_exams: performance.length
    };
  }
}
