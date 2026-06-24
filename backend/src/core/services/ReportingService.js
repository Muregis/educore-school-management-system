import { BaseRepository } from '../BaseRepository.js';

/**
 * Reporting Service
 * Implements enterprise reporting functionality
 */
export class ReportingService {
  constructor() {
    this.studentsRepository = new BaseRepository('students');
    this.paymentsRepository = new BaseRepository('payments');
    this.attendanceRepository = new BaseRepository('attendance');
    this.examResultsRepository = new BaseRepository('exam_results');
  }

  /**
   * Generate student enrollment report
   */
  async generateEnrollmentReport(schoolId, filters = {}) {
    const students = await this.studentsRepository.findAll({
      school_id: schoolId,
      ...filters
    });

    const byClass = {};
    const byGender = {};
    const byStatus = {};

    students.data?.forEach(student => {
      // By class
      const classKey = student.class_id || 'Unassigned';
      byClass[classKey] = (byClass[classKey] || 0) + 1;

      // By gender
      const genderKey = student.gender || 'Unknown';
      byGender[genderKey] = (byGender[genderKey] || 0) + 1;

      // By status
      const statusKey = student.status || 'Unknown';
      byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
    });

    return {
      total_students: students.data?.length || 0,
      by_class: byClass,
      by_gender: byGender,
      by_status: byStatus,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(schoolId, startDate, endDate) {
    const payments = await this.paymentsRepository.findAll({
      school_id: schoolId
    });

    const filtered = payments.data?.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return paymentDate >= new Date(startDate) && paymentDate <= new Date(endDate);
    }) || [];

    const totalCollected = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
    const byPaymentMethod = {};
    const byStatus = {};

    filtered.forEach(payment => {
      const methodKey = payment.payment_method || 'Unknown';
      byPaymentMethod[methodKey] = (byPaymentMethod[methodKey] || 0) + (payment.amount || 0);

      const statusKey = payment.status || 'Unknown';
      byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
    });

    return {
      total_collected: totalCollected,
      total_transactions: filtered.length,
      by_payment_method: byPaymentMethod,
      by_status: byStatus,
      period: { start: startDate, end: endDate },
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Generate attendance report
   */
  async generateAttendanceReport(schoolId, startDate, endDate, classId = null) {
    const filters = {
      school_id: schoolId
    };

    if (classId) {
      filters.class_id = classId;
    }

    const attendance = await this.attendanceRepository.findAll(filters);
    const filtered = attendance.data?.filter(a => {
      const attendanceDate = new Date(a.attendance_date);
      return attendanceDate >= new Date(startDate) && attendanceDate <= new Date(endDate);
    }) || [];

    const totalPresent = filtered.filter(a => a.status === 'present').length;
    const totalAbsent = filtered.filter(a => a.status === 'absent').length;
    const totalLate = filtered.filter(a => a.status === 'late').length;

    const byDate = {};
    filtered.forEach(a => {
      const dateKey = a.attendance_date;
      byDate[dateKey] = byDate[dateKey] || { present: 0, absent: 0, late: 0 };
      byDate[dateKey][a.status] = (byDate[dateKey][a.status] || 0) + 1;
    });

    return {
      total_records: filtered.length,
      total_present: totalPresent,
      total_absent: totalAbsent,
      total_late: totalLate,
      attendance_rate: filtered.length > 0 ? Math.round((totalPresent / filtered.length) * 100) : 0,
      by_date: byDate,
      period: { start: startDate, end: endDate },
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Generate academic performance report
   */
  async generateAcademicReport(schoolId, examId) {
    const results = await this.examResultsRepository.findAll({
      school_id: schoolId
    });

    const examResults = results.data?.filter(r => r.exam_id === examId) || [];

    if (examResults.length === 0) {
      return {
        total_students: 0,
        average_marks: 0,
        highest_marks: 0,
        lowest_marks: 0,
        pass_count: 0,
        fail_count: 0,
        generated_at: new Date().toISOString()
      };
    }

    const marks = examResults.map(r => r.marks);
    const average = marks.reduce((sum, m) => sum + m, 0) / marks.length;
    const highest = Math.max(...marks);
    const lowest = Math.min(...marks);
    const passCount = marks.filter(m => m >= 50).length;
    const failCount = marks.length - passCount;

    const gradeDistribution = {};
    examResults.forEach(r => {
      const grade = r.grade || 'N/A';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    return {
      total_students: examResults.length,
      average_marks: Math.round(average * 100) / 100,
      highest_marks: highest,
      lowest_marks: lowest,
      pass_count: passCount,
      fail_count: failCount,
      pass_rate: Math.round((passCount / examResults.length) * 100),
      grade_distribution: gradeDistribution,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Generate dashboard summary
   */
  async generateDashboardSummary(schoolId) {
    const students = await this.studentsRepository.findAll({ school_id: schoolId });
    const payments = await this.paymentsRepository.findAll({ school_id: schoolId });

    const totalStudents = students.data?.length || 0;
    const activeStudents = students.data?.filter(s => s.status === 'active').length || 0;
    const totalPayments = payments.data?.length || 0;
    const totalRevenue = payments.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    return {
      students: {
        total: totalStudents,
        active: activeStudents
      },
      finance: {
        total_payments: totalPayments,
        total_revenue: totalRevenue
      },
      generated_at: new Date().toISOString()
    };
  }
}
