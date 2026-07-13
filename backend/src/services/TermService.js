import { database } from "../config/db.js";
import { logAuditEvent } from "../helpers/audit.logger.js";
import { calculateStudentFeeBalance } from "./feeBalanceCalculator.js";

/**
 * Term Lifecycle Service
 * Manages academic term states and transitions
 */
export class TermService {
  /**
   * Create a new academic term
   */
  static async createTerm(schoolId, termData) {
    try {
      const { term_name, academic_year, start_date, end_date, status = 'upcoming' } = termData;
      
      // Validate dates
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      if (endDate <= startDate) {
        throw new Error('End date must be after start date');
      }
      
      // Check for existing term with same name and year
      const { data: existing } = await database.query('academic_terms', {
        where: { term_name, academic_year, school_id: schoolId },
        limit: 1
      });
      
      if (existing && existing.length > 0) {
        throw new Error(`Term ${term_name} ${academic_year} already exists`);
      }
      
      // If setting as current, unset any existing current term
      if (status === 'active') {
        await database.update('academic_terms', {
          is_current: false,
          status: 'closed'
        }, {
          school_id: schoolId,
          is_current: true
        });
      }
      
      const { data: term } = await database.insert('academic_terms', {
        school_id: schoolId,
        term_name,
        academic_year,
        start_date: start_date,
        end_date: end_date,
        status,
        is_current: status === 'active'
      });
      
      return term[0];
    } catch (error) {
      console.error('Create term error:', error);
      throw error;
    }
  }
  
  /**
   * Get current active term for school
   */
  static async getCurrentTerm(schoolId) {
    try {
      const { data: terms } = await database.query('academic_terms', {
        where: { 
          school_id: schoolId,
          is_current: true,
          status: 'active'
        },
        limit: 1,
        order: { column: 'term_id', ascending: false }
      });
      
      if (terms && terms.length > 0) {
        return terms[0];
      }
      
      // Fallback: find term that is currently active by date
      const { data: currentByDate } = await database.query('academic_terms', {
        where: { 
          school_id: schoolId,
          status: 'active'
        },
        limit: 1,
        order: { column: 'end_date', ascending: false }
      });
      
      return currentByDate?.[0] || null;
    } catch (error) {
      console.error('Get current term error:', error);
      return null;
    }
  }
  
  /**
   * Get all terms for school
   */
  static async getTerms(schoolId, status = null) {
    try {
      const query = {
        where: { school_id: schoolId },
        order: { column: 'academic_year', ascending: false }
      };
      
      if (status) {
        query.where.status = status;
      }
      
      const { data: terms } = await database.query('academic_terms', query);
      return terms || [];
    } catch (error) {
      console.error('Get terms error:', error);
      return [];
    }
  }
  
  /**
   * Activate a term (set as current)
   */
  static async activateTerm(schoolId, termId, userId) {
    const client = database;
    
    try {
      // First, deactivate any currently active term
      await client.update('academic_terms', {
        status: 'closed',
        is_current: false
      }, {
        school_id: schoolId,
        is_current: true
      });
      
      // Then activate the requested term
      const { data: term } = await client.update('academic_terms', {
        status: 'active',
        is_current: true
      }, {
        term_id: termId,
        school_id: schoolId
      });
      
      await logAuditEvent({ user: { userId, schoolId } }, {
        action: 'term.activate',
        entity: 'academic_term',
        entityId: termId,
        description: `Activated term ${term.term_name} ${term.academic_year}`
      });
      
      return term;
    } catch (error) {
      console.error('Activate term error:', error);
      throw error;
    }
  }
  
  /**
   * Close a term (lock it from modifications)
   */
  static async closeTerm(schoolId, termId, userId) {
    const client = database;
    
    try {
      const { data: term } = await client.update('academic_terms', {
        status: 'closed'
      }, {
        term_id: termId,
        school_id: schoolId
      });
      
      await logAuditEvent({ user: { userId, schoolId } }, {
        action: 'term.close',
        entity: 'academic_term',
        entityId: termId,
        description: `Closed term ${term.term_name} ${term.academic_year}`
      });
      
      return term;
    } catch (error) {
      console.error('Close term error:', error);
      throw error;
    }
  }
  
  /**
   * Check if term can be modified
   */
  static async canModifyTerm(schoolId, termId) {
    const term = await this.getTerm(schoolId, termId);
    
    if (!term) {
      return { canModify: false, reason: 'Term not found' };
    }
    
    if (term.status === 'locked') {
      return { canModify: false, reason: 'Term is locked' };
    }
    
    if (term.status === 'closed') {
      return { canModify: false, reason: 'Term is closed' };
    }
    
    // Check if term has ended
    const now = new Date();
    const endDate = new Date(term.end_date);
    if (now > endDate && term.status === 'active') {
      return { canModify: false, reason: 'Term has ended' };
    }
    
    return { canModify: true };
  }
  
  /**
   * Get single term
   */
  static async getTerm(schoolId, termId) {
    try {
      const { data: terms } = await database.query('academic_terms', {
        where: { term_id: termId, school_id: schoolId },
        limit: 1
      });
      
      return terms?.[0] || null;
    } catch (error) {
      console.error('Get term error:', error);
      return null;
    }
  }
  
  static async findNextTerm(schoolId, currentTermId) {
    try {
      const allTerms = await this.getTerms(schoolId, 'upcoming');
      const currentTerm = await this.getTerm(schoolId, currentTermId);
      if (!currentTerm) return null;

      // First try to find the next term in the same academic year
      const sameYear = allTerms
        .filter(t => t.academic_year === currentTerm.academic_year && t.term_id !== currentTermId)
        .sort((a, b) => (a.term_order || 0) - (b.term_order || 0));

      if (sameYear.length > 0) return sameYear[0].term_id;

      // Fall back to the first upcoming term in the next academic year
      const nextYear = allTerms
        .filter(t => t.academic_year > currentTerm.academic_year)
        .sort((a, b) => a.academic_year - b.academic_year || (a.term_order || 0) - (b.term_order || 0));

      return nextYear.length > 0 ? nextYear[0].term_id : null;
    } catch (error) {
      console.error('Find next term error:', error);
      return null;
    }
  }

  /**
   * End term transition - comprehensive term end workflow
   * Handles closing term, archiving data, and preparing for next term
   */
  static async endTermTransition(schoolId, termId, userId, options = {}) {
    const { carryForwardBalances = true, archiveGrades = true, nextTermId } = options;
    const client = database;
    
    try {
      // Get current term details
      const term = await this.getTerm(schoolId, termId);
      if (!term) {
        throw new Error('Term not found');
      }
      
      if (term.status === 'closed') {
        throw new Error('Term is already closed');
      }
      
      const summary = {
        termClosed: false,
        gradesArchived: 0,
        balancesCarriedForward: 0,
        studentsProcessed: 0,
        feeStructuresUpdated: 0
      };
      
      // Step 1: Close the term
      await client.update('academic_terms', {
        status: 'closed',
        is_current: false,
        closed_at: new Date().toISOString(),
        closed_by: userId
      }, {
        term_id: termId,
        school_id: schoolId
      });
      summary.termClosed = true;
      
      // Step 2: Archive grades if requested
      if (archiveGrades) {
        const { data: grades } = await client.query('grades', {
          where: { 
            school_id: schoolId,
            term: term.term_name
          }
        });
        
        if (grades && grades.length > 0) {
          // Mark grades as archived (add to archived_grades table or update status)
          await client.update('grades', {
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_term_id: termId
          }, {
            school_id: schoolId,
            term: term.term_name
          });
          summary.gradesArchived = grades.length;
        }
      }
      
      // Step 3: Carry forward student balances if requested
      if (carryForwardBalances) {
        const { data: students } = await client.query('students', {
          where: { 
            school_id: schoolId,
            status: 'active'
          }
        });
        
        // Get fee structures for current term
        const { data: feeStructures } = await client.query('fee_structures', {
          where: { 
            school_id: schoolId,
            term: term.term_name
          }
        });
        
        // Get payments for current term only
        const { data: payments } = await client.query('payments', {
          where: { 
            school_id: schoolId,
            term: term.term_name,
            status: 'paid'
          }
        });
        
        if (students && students.length > 0) {
          let balanceCount = 0;
          for (const student of students) {
            // Use canonical balance calculator for accurate calculation
            const balanceInfo = calculateStudentFeeBalance({
              student,
              feeStructures: feeStructures || [],
              payments: payments || []
            });
            
            // If student has outstanding balance, carry it forward as opening balance
            if (balanceInfo.balance > 0) {
              await client.update('students', {
                opening_balance: balanceInfo.balance,
                opening_balance_type: 'owing',
                opening_balance_term: term.term_name,
                updated_at: new Date().toISOString()
              }, {
                student_id: student.student_id
              });
              balanceCount++;
            } else if (balanceInfo.isOverpaid) {
              // Handle overpayments as credit
              await client.update('students', {
                opening_balance: balanceInfo.overpaymentAmount,
                opening_balance_type: 'credit',
                opening_balance_term: term.term_name,
                updated_at: new Date().toISOString()
              }, {
                student_id: student.student_id
              });
              balanceCount++;
            }
          }
          summary.balancesCarriedForward = balanceCount;
          summary.studentsProcessed = students.length;
        }
      }
      
      // Step 4: Activate next term and copy fee structures
      const nextTermToActivate = nextTermId || await this.findNextTerm(schoolId, termId);
      if (nextTermToActivate) {
        await this.activateTerm(schoolId, nextTermToActivate, userId);
        
        const { data: currentFeeStructures } = await client.query('fee_structures', {
          where: { 
            school_id: schoolId,
            term: term.term_name
          }
        });
        
        if (currentFeeStructures && currentFeeStructures.length > 0) {
          const nextTerm = await this.getTerm(schoolId, nextTermToActivate);
          if (nextTerm) {
            for (const feeStruct of currentFeeStructures) {
              const { data: existing } = await client.query('fee_structures', {
                where: {
                  class_name: feeStruct.class_name,
                  term: nextTerm.term_name,
                  school_id: schoolId
                },
                limit: 1
              });
              
              if (!existing || existing.length === 0) {
                await client.insert('fee_structures', {
                  school_id: schoolId,
                  class_name: feeStruct.class_name,
                  term: nextTerm.term_name,
                  tuition: feeStruct.tuition,
                  activity: feeStruct.activity,
                  misc: feeStruct.misc,
                  created_at: new Date().toISOString()
                });
                summary.feeStructuresUpdated++;
              }
            }
          }
        }
      }
      
      // Log the transition
      await logAuditEvent({ user: { userId, schoolId } }, {
        action: 'term.transition',
        entity: 'academic_term',
        entityId: termId,
        description: `Ended term ${term.term_name} ${term.academic_year} and prepared for transition`,
        metadata: summary
      });
      
      return {
        term: { ...term, status: 'closed' },
        summary: {
          ...summary,
          promoted: summary.studentsProcessed,
        }
      };
    } catch (error) {
      console.error('End term transition error:', error);
      throw error;
    }
  }
}

export default TermService;
