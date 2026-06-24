import { StudentEnrollmentRepository, StudentStatusHistoryRepository, AlumniRepository } from '../repositories/StudentLifecycleRepository.js';
import { BaseRepository } from '../BaseRepository.js';

/**
 * Student Lifecycle Service
 * Implements permanent student record management
 */
export class StudentLifecycleService {
  constructor() {
    this.enrollmentRepository = new StudentEnrollmentRepository();
    this.statusHistoryRepository = new StudentStatusHistoryRepository();
    this.alumniRepository = new AlumniRepository();
    this.studentRepository = new BaseRepository('students');
  }

  /**
   * Enroll student in class
   */
  async enrollStudent(data, context = {}) {
    // Verify student exists
    const student = await this.studentRepository.findById(data.student_id);
    if (!student) {
      throw new Error('Student not found');
    }

    // Check if student has active enrollment
    const currentEnrollment = await this.enrollmentRepository.findCurrent(data.student_id);
    if (currentEnrollment) {
      throw new Error('Student already has an active enrollment');
    }

    // Create enrollment record
    const enrollment = await this.enrollmentRepository.create({
      ...data,
      enrollment_status: 'active',
      enrollment_date: new Date().toISOString().split('T')[0]
    }, context);

    // Update student status
    await this.updateStudentStatus(data.student_id, 'enrolled', 'Student enrolled', context);

    return enrollment;
  }

  /**
   * Transfer student to new class
   */
  async transferStudent(studentId, newClassId, newStreamId, reason, context = {}) {
    const currentEnrollment = await this.enrollmentRepository.findCurrent(studentId);
    if (!currentEnrollment) {
      throw new Error('Student has no active enrollment');
    }

    // Close current enrollment
    await this.enrollmentRepository.update(currentEnrollment.id, {
      enrollment_status: 'transferred',
      exit_date: new Date().toISOString().split('T')[0],
      exit_reason: reason
    }, context);

    // Create new enrollment
    const newEnrollment = await this.enrollmentRepository.create({
      student_id: studentId,
      school_id: currentEnrollment.school_id,
      academic_year_id: currentEnrollment.academic_year_id,
      term_id: currentEnrollment.term_id,
      class_id: newClassId,
      stream_id: newStreamId,
      enrollment_status: 'active',
      enrollment_date: new Date().toISOString().split('T')[0]
    }, context);

    // Update student status
    await this.updateStudentStatus(studentId, 'transferred', reason, context);

    return newEnrollment;
  }

  /**
   * Withdraw student
   */
  async withdrawStudent(studentId, reason, context = {}) {
    const currentEnrollment = await this.enrollmentRepository.findCurrent(studentId);
    if (!currentEnrollment) {
      throw new Error('Student has no active enrollment');
    }

    // Close enrollment
    await this.enrollmentRepository.update(currentEnrollment.id, {
      enrollment_status: 'withdrawn',
      exit_date: new Date().toISOString().split('T')[0],
      exit_reason: reason
    }, context);

    // Update student status
    await this.updateStudentStatus(studentId, 'withdrawn', reason, context);

    // Soft delete student record
    await this.studentRepository.softDelete(studentId, context.userId);

    return { success: true };
  }

  /**
   * Graduate student
   */
  async graduateStudent(studentId, context = {}) {
    const currentEnrollment = await this.enrollmentRepository.findCurrent(studentId);
    if (!currentEnrollment) {
      throw new Error('Student has no active enrollment');
    }

    // Close enrollment
    await this.enrollmentRepository.update(currentEnrollment.id, {
      enrollment_status: 'graduated',
      exit_date: new Date().toISOString().split('T')[0],
      exit_reason: 'Graduation'
    }, context);

    // Create alumni record
    const alumni = await this.alumniRepository.create({
      student_id: studentId,
      school_id: currentEnrollment.school_id,
      graduation_date: new Date().toISOString().split('T')[0],
      final_class_id: currentEnrollment.class_id,
      final_stream_id: currentEnrollment.stream_id
    }, context);

    // Update student status
    await this.updateStudentStatus(studentId, 'graduated', 'Student graduated', context);

    return alumni;
  }

  /**
   * Suspend student
   */
  async suspendStudent(studentId, reason, context = {}) {
    const currentEnrollment = await this.enrollmentRepository.findCurrent(studentId);
    if (!currentEnrollment) {
      throw new Error('Student has no active enrollment');
    }

    // Update enrollment status
    await this.enrollmentRepository.update(currentEnrollment.id, {
      enrollment_status: 'suspended'
    }, context);

    // Update student status
    await this.updateStudentStatus(studentId, 'suspended', reason, context);

    return { success: true };
  }

  /**
   * Reinstate suspended student
   */
  async reinstateStudent(studentId, reason, context = {}) {
    const currentEnrollment = await this.enrollmentRepository.findCurrent(studentId);
    if (!currentEnrollment) {
      throw new Error('Student has no active enrollment');
    }

    if (currentEnrollment.enrollment_status !== 'suspended') {
      throw new Error('Student is not suspended');
    }

    // Update enrollment status
    await this.enrollmentRepository.update(currentEnrollment.id, {
      enrollment_status: 'active'
    }, context);

    // Update student status
    await this.updateStudentStatus(studentId, 'active', reason, context);

    return { success: true };
  }

  /**
   * Update student status with history
   */
  async updateStudentStatus(studentId, status, reason, context = {}) {
    const student = await this.studentRepository.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Record status change in history
    await this.statusHistoryRepository.create({
      student_id: studentId,
      school_id: student.school_id,
      status,
      previous_status: student.status,
      reason,
      changed_by: context.userId
    }, context);

    // Update student status
    await this.studentRepository.update(studentId, { status }, context);

    return { success: true };
  }

  /**
   * Get student complete history
   */
  async getStudentHistory(studentId) {
    const enrollments = await this.enrollmentRepository.findHistory(studentId);
    const statusHistory = await this.statusHistoryRepository.findByStudent(studentId);
    const student = await this.studentRepository.findById(studentId);

    return {
      student,
      enrollments,
      statusHistory
    };
  }

  /**
   * Get class roster for academic year
   */
  async getClassRoster(classId, academicYearId) {
    return await this.enrollmentRepository.findByClass(classId, academicYearId);
  }
}
