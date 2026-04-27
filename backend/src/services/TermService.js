import { database } from "../config/db.js";
import { logAuditEvent } from "../helpers/audit.logger.js";

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
}

export default TermService;
