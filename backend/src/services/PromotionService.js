import { database } from "../config/db.js";
import { logAuditEvent } from "../helpers/audit.logger.js";
import GradeCalculationService from "./GradeCalculationService.js";

/**
 * Promotion Service
 * Handles student promotion workflows
 */
export class PromotionService {
  /**
   * Promote students from one class to another
   */
  static async promoteStudents(schoolId, fromClass, toClass, academicYear, options = {}) {
    const { dryRun = false, autoApprove = false, userId = null, minPercentage = null } = options;
    
    try {
      // Get all active students in the source class
      const { data: students } = await database.query('students', {
        where: {
          school_id: schoolId,
          class_name: fromClass,
          status: 'active',
          is_deleted: false
        }
      });
      
      if (!students || students.length === 0) {
        return {
          success: true,
          promoted: 0,
          skipped: 0,
          errors: [],
          message: 'No students found to promote'
        };
      }
      
      const promoted = [];
      const skipped = [];
      const errors = [];
      
      for (const student of students) {
        try {
          // Check if student meets promotion criteria
          const canPromote = await this.checkPromotionCriteria(schoolId, student.student_id, fromClass, toClass, minPercentage);
          
          if (!canPromote.canPromote) {
            skipped.push({
              studentId: student.student_id,
              name: `${student.first_name} ${student.last_name}`,
              reason: canPromote.reason
            });
            continue;
          }
          
          if (!dryRun) {
            // Update student class
            await database.update('students', {
              class_name: toClass,
              previous_class: fromClass,
              promotion_year: academicYear,
              updated_at: new Date().toISOString()
            }, {
              student_id: student.student_id,
              school_id: schoolId
            });
            
            // Create enrollment history record
            await this.createEnrollmentHistory(schoolId, student.student_id, null, fromClass, toClass, academicYear, 'promoted');
            
            promoted.push({
              studentId: student.student_id,
              name: `${student.first_name} ${student.last_name}`,
              fromClass,
              toClass
            });
          } else {
            promoted.push({
              studentId: student.student_id,
              name: `${student.first_name} ${student.last_name}`,
              fromClass,
              toClass,
              wouldPromote: true
            });
          }
        } catch (error) {
          errors.push({
            studentId: student.student_id,
            error: error.message
          });
        }
      }
      
      // Log promotion activity
      if (!dryRun && userId) {
        await logAuditEvent({ user: { userId, schoolId } }, {
          action: 'students.promote',
          entity: 'promotion_batch',
          description: `Promoted ${promoted.length} students from ${fromClass} to ${toClass}. Skipped: ${skipped.length}. Errors: ${errors.length}`,
          metadata: { fromClass, toClass, promoted: promoted.length, skipped: skipped.length, errors: errors.length }
        });
      }
      
      return {
        success: errors.length === 0,
        promoted: promoted.length,
        skipped: skipped.length,
        errors,
        promotedStudents: promoted,
        skippedStudents: skipped,
        dryRun,
        message: this.generatePromotionMessage(promoted.length, skipped.length, errors.length, dryRun)
      };
    } catch (error) {
      console.error('Promote students error:', error);
      throw error;
    }
  }
  
  /**
   * Check if a student can be promoted
   */
  static async checkPromotionCriteria(schoolId, studentId, fromClass, toClass, minPercentage = null) {
    try {
      // Check if student exists and is active
      const { data: student } = await database.query('students', {
        where: {
          student_id: studentId,
          school_id: schoolId,
          is_deleted: false
        },
        limit: 1
      });
      
      if (!student || student.length === 0) {
        return { canPromote: false, reason: 'Student not found' };
      }
      
      if (student[0].status !== 'active') {
        return { canPromote: false, reason: 'Student is not active' };
      }
      
      // Check if student is in the correct class
      if (student[0].class_name !== fromClass) {
        return { canPromote: false, reason: `Student is in ${student[0].class_name}, not ${fromClass}` };
      }
      
      // If minimum percentage is required, check student's performance
      if (minPercentage !== null) {
        const meanResult = await GradeCalculationService.calculateMeanGrade(
          schoolId, studentId, 'Term 3', new Date().getFullYear()
        );
        
        if (meanResult.meanPoints < minPercentage) {
          return { 
            canPromote: false, 
            reason: `Mean grade ${meanResult.meanPoints}% is below minimum required ${minPercentage}%` 
          };
        }
      }
      
      // Check for unpaid balances
      const { data: unpaidPayments } = await database.query('payments', {
        where: {
          student_id: studentId,
          school_id: schoolId,
          status: { 'in': "('pending','failed')" },
          is_deleted: false
        },
        limit: 1
      });
      
      if (unpaidPayments && unpaidPayments.length > 0) {
        return { canPromote: false, reason: 'Student has unpaid fee balances' };
      }
      
      return { canPromote: true, reason: 'Eligible for promotion' };
    } catch (error) {
      console.error('Check promotion criteria error:', error);
      return { canPromote: false, reason: 'Error checking criteria' };
    }
  }
  
  /**
   * Get next class in progression
   */
  static getNextClass(currentClass) {
    const progression = {
      'Playgroup': 'PP1',
      'PP1': 'PP2',
      'PP2': 'Grade 1',
      'Grade 1': 'Grade 2',
      'Grade 2': 'Grade 3',
      'Grade 3': 'Grade 4',
      'Grade 4': 'Grade 5',
      'Grade 5': 'Grade 6',
      'Grade 6': 'Grade 7',
      'Grade 7': 'Grade 8',
      'Grade 8': 'Grade 9',
      'Grade 9': 'Form 1'
    };
    
    return progression[currentClass] || null;
  }
  
  /**
   * Create enrollment history record
   */
  static async createEnrollmentHistory(schoolId, studentId, fromClassId, fromClassName, toClassName, academicYear, action) {
    try {
      // Note: In this implementation, we track history in the students table
      // via previous_class and promotion_year fields
      // A full history table could be added if needed
      
      await logAuditEvent({ user: { schoolId } }, {
        action: `student.${action}`,
        entity: 'enrollment_history',
        entityId: studentId,
        description: `${action}: ${fromClassName} → ${toClassName} (${academicYear})`
      });
    } catch (error) {
      console.error('Create enrollment history error:', error);
    }
  }
  
  /**
   * Get promotion rules for school
   */
  static async getPromotionRules(schoolId) {
    try {
      // Default CBC promotion rules
      return {
        progression: {
          'Playgroup': 'PP1',
          'PP1': 'PP2',
          'PP2': 'Grade 1',
          'Grade 1': 'Grade 2',
          'Grade 2': 'Grade 3',
          'Grade 3': 'Grade 4',
          'Grade 4': 'Grade 5',
          'Grade 5': 'Grade 6',
          'Grade 6': 'Grade 7',
          'Grade 7': 'Grade 8',
          'Grade 8': 'Grade 9',
          'Grade 9': 'Form 1'
        },
        requirements: {
          minimumPercentage: 50, // Default minimum percentage
          clearFees: true, // Must have cleared all fees
          goodStanding: true // Must be in good disciplinary standing
        }
      };
    } catch (error) {
      console.error('Get promotion rules error:', error);
      return null;
    }
  }
  
  /**
   * Generate promotion summary message
   */
  generatePromotionMessage(promoted, skipped, errors, dryRun) {
    if (dryRun) {
      return `Dry run: ${promoted} student(s) would be promoted, ${skipped} would be skipped`;
    }
    
    let message = `${promoted} student(s) promoted successfully`;
    if (skipped > 0) message += `, ${skipped} skipped`;
    if (errors > 0) message += `, ${errors} errors`;
    
    return message;
  }
}

export default PromotionService;
