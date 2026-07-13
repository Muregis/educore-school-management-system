// =====================================================
// BACKEND SERVICE IMPLEMENTATIONS
// Parallel services for new EduCore features
// =====================================================

import { supabase } from '../config/supabaseClient.js';
import { logAuditEvent } from '../helpers/audit.logger.js';
import { calculateStudentFeeBalance } from './feeBalanceCalculator.js';

// =====================================================
// ACADEMIC YEAR SERVICE
// =====================================================

export class AcademicYearService {
  /**
   * Get current academic year for a school
   */
  static async getCurrentYear(schoolId) {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting current academic year:', error);
      return null;
    }
  }

  /**
   * Get current academic year with fallback to legacy system
   */
  static async getCurrentYearWithFallback(schoolId) {
    // Try new system first
    let year = await this.getCurrentYear(schoolId);
    if (year) return year;

    // Fallback to legacy system
    try {
      const { data } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('school_id', schoolId)
        .eq('setting_key', 'academic_year')
        .single();

      return {
        year_label: data?.setting_value,
        is_legacy: true
      };
    } catch (error) {
      console.error('Error getting legacy academic year:', error);
      return null;
    }
  }

  /**
   * Create academic year from legacy data
   */
  static async initializeFromLegacy(schoolId) {
    try {
      // Get distinct academic years from classes
      const { data: legacyYears } = await supabase
        .from('classes')
        .select('academic_year')
        .eq('school_id', schoolId)
        .neq('is_deleted', true)
        .not('academic_year', 'is', null);

      if (!legacyYears?.length) return;

      const uniqueYears = [...new Set(legacyYears.map(c => c.academic_year))];

      // Get current year from settings
      const { data: currentSetting } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('school_id', schoolId)
        .eq('setting_key', 'academic_year')
        .single();

      // Create academic year records
      const yearRecords = uniqueYears.map(year => ({
        school_id: schoolId,
        year_label: year.toString(),
        start_date: new Date(year, 0, 1), // January 1st of the year
        end_date: new Date(year, 11, 31), // December 31st of the year
        status: 'active',
        legacy_year_value: year,
        is_current: currentSetting?.setting_value === year.toString(),
        created_at: new Date(),
        updated_at: new Date()
      }));

      const { error } = await supabase
        .from('academic_years')
        .upsert(yearRecords, { onConflict: 'school_id,year_label' });

      if (error) throw error;

      return yearRecords;
    } catch (error) {
      console.error('Error initializing academic years:', error);
      throw error;
    }
  }

  /**
   * Create new academic year
   */
  static async createYear(schoolId, yearData) {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .insert({
          school_id: schoolId,
          ...yearData,
          created_at: new Date(),
          updated_at: new Date()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating academic year:', error);
      throw error;
    }
  }
}

// =====================================================
// TERM SERVICE
// =====================================================

export class TermService {
  /**
   * Get current term for a school
   */
  static async getCurrentTerm(schoolId) {
    try {
      const { data, error } = await supabase
        .from('terms')
        .select(`
          *,
          academic_years!inner(year_label)
        `)
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting current term:', error);
      return null;
    }
  }

  /**
   * Get current term with fallback to legacy system
   */
  static async getCurrentTermWithFallback(schoolId) {
    // Try new system first
    let term = await this.getCurrentTerm(schoolId);
    if (term) return term;

    // Fallback to legacy system
    try {
      const { data } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('school_id', schoolId)
        .eq('setting_key', 'current_term')
        .single();

      return {
        term_name: data?.setting_value,
        is_legacy: true
      };
    } catch (error) {
      console.error('Error getting legacy term:', error);
      return null;
    }
  }

  /**
   * Initialize terms from legacy data
   */
  static async initializeFromLegacy(schoolId) {
    try {
      // Get distinct terms from invoices and payments
      const { data: legacyTerms } = await supabase
        .from('invoices')
        .select('term')
        .eq('school_id', schoolId)
        .neq('is_deleted', true)
        .neq('term', null)
        .neq('term', '');

      const { data: paymentTerms } = await supabase
        .from('payments')
        .select('term')
        .eq('school_id', schoolId)
        .neq('is_deleted', true)
        .neq('term', null)
        .neq('term', '');

      const allTerms = [
        ...(legacyTerms || []).map(i => i.term),
        ...(paymentTerms || []).map(p => p.term)
      ];

      const uniqueTerms = [...new Set(allTerms)];

      if (!uniqueTerms.length) return;

      // Get current term from settings
      const { data: currentSetting } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('school_id', schoolId)
        .eq('setting_key', 'current_term')
        .single();

      // Get current academic year
      const currentYear = await AcademicYearService.getCurrentYear(schoolId);
      if (!currentYear) return;

      // Create term records
      const termRecords = uniqueTerms.map((term, index) => ({
        school_id: schoolId,
        academic_year_id: currentYear.academic_year_id,
        term_name: term,
        term_order: index + 1,
        start_date: new Date(), // Placeholder - should be calculated
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        status: 'active',
        legacy_term_value: term,
        is_current: currentSetting?.setting_value === term,
        created_at: new Date(),
        updated_at: new Date()
      }));

      const { error } = await supabase
        .from('terms')
        .upsert(termRecords, { onConflict: 'school_id,term_name' });

      if (error) throw error;

      return termRecords;
    } catch (error) {
      console.error('Error initializing terms:', error);
      throw error;
    }
  }

  /**
   * Check if term can be closed
   */
  static async canCloseTerm(termId) {
    try {
      // Check if all invoices are generated
      const { data: invoices } = await supabase
        .from('invoices')
        .select('status')
        .eq('term_id', termId) // This would need to be mapped
        .neq('is_deleted', true);

      const allInvoicesPaid = invoices?.every(inv => inv.status === 'paid') ?? false;

      // Check if grades are finalized (this would need grade tables)
      // const gradesFinalized = await this.checkGradesFinalized(termId);

      return {
        canClose: allInvoicesPaid,
        reasons: allInvoicesPaid ? [] : ['Outstanding invoices exist']
      };
    } catch (error) {
      console.error('Error checking term closure eligibility:', error);
      return { canClose: false, reasons: ['Error checking eligibility'] };
    }
  }
}

// =====================================================
// TERM TRANSITION SERVICE
// =====================================================

export class TermTransitionService {
  /**
   * Close an academic term
   */
  static async closeTerm(schoolId, termId, userId) {
    try {
      // 1. Validate term can be closed
      const eligibility = await TermService.canCloseTerm(termId);
      if (!eligibility.canClose) {
        throw new Error(`Cannot close term: ${eligibility.reasons.join(', ')}`);
      }

      // 2. Lock the term
      await supabase
        .from('terms')
        .update({
          status: 'completed',
          updated_at: new Date()
        })
        .eq('term_id', termId);

      // 3. Calculate and create carry-forward entries
      await this.createCarryForwards(schoolId, termId, userId);

      // 4. Promote students to next class
      await this.promoteStudents(schoolId, termId, userId);

      // 5. Record transition
      await supabase
        .from('term_transitions')
        .insert({
          school_id: schoolId,
          term_id: termId,
          transition_type: 'close',
          triggered_by: userId,
          transition_data: {
            eligibility: eligibility,
            timestamp: new Date()
          },
          created_at: new Date()
        });

      return { success: true, termId };
    } catch (error) {
      console.error('Error closing term:', error);
      throw error;
    }
  }

  /**
   * Promote students to next class based on promotion rules
   */
  static async promoteStudents(schoolId, termId, userId) {
    try {
      // Get current term
      const { data: currentTerm } = await supabase
        .from('terms')
        .select('term_id, term_name, academic_year_id')
        .eq('term_id', termId)
        .single();

      if (!currentTerm) throw new Error('Term not found');

      // Get active classes for this school
      const { data: classes } = await supabase
        .from('classes')
        .select('class_id, class_name, next_class_name')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .order('class_name');

      // Get promotion rules
      const { data: rules } = await supabase
        .from('promotion_rules')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .eq('is_deleted', false);

      // Get students with their results for the term
      const { data: students } = await supabase
        .from('students')
        .select('student_id, first_name, last_name, class_id, class_name, status')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .eq('status', 'active');

      const promoted = [];
      const classMap = new Map((classes || []).map(c => [c.class_name, c]));
      const ruleMap = new Map((rules || []).map(r => [r.from_class_name, r]));

      for (const student of students || []) {
        const currentClass = classMap.get(student.class_name);
        const nextClassName = currentClass?.next_class_name;

        if (!nextClassName) {
          // No next class - student graduates or stays (handled elsewhere)
          continue;
        }

        const nextClass = classMap.get(nextClassName);
        if (!nextClass) {
          console.log(`Next class "${nextClassName}" not found for promotion`);
          continue;
        }

        // Check promotion rule
        const rule = ruleMap.get(student.class_name);
        const shouldAutoPromote = rule?.auto_promote ?? true;

        if (shouldAutoPromote) {
          // Update student to next class
          const { error: updateError } = await supabase
            .from('students')
            .update({
              class_id: nextClass.class_id,
              class_name: nextClassName,
              updated_at: new Date()
            })
            .eq('student_id', student.student_id);

          if (updateError) {
            console.error('Error promoting student:', updateError);
            continue;
          }

          // Record promotion decision
          await supabase
            .from('promotion_decisions')
            .insert({
              student_id: student.student_id,
              academic_year_id: currentTerm.academic_year_id,
              from_class_id: student.class_id,
              to_class_id: nextClass.class_id,
              decision: 'promoted',
              decision_date: new Date().toISOString().split('T')[0],
              decided_by: userId
            });

          promoted.push({
            student_id: student.student_id,
            from_class: student.class_name,
            to_class: nextClassName
          });
        }
      }

      console.log(`Promoted ${promoted.length} students`);
      return { promoted };
    } catch (error) {
      console.error('Error promoting students:', error);
      throw error;
    }
  }

  /**
   * Create carry-forward entries for unpaid balances
   */
  static async createCarryForwards(schoolId, termId, userId) {
    try {
      // Get unpaid balances from ledger
      const { data: unpaidBalances } = await supabase
        .from('fee_balance_ledger')
        .select(`
          student_id,
          balance_after,
          academic_year_id
        `)
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .eq('balance_after', supabase.raw('balance_after > 0'));

      if (!unpaidBalances?.length) return;

      // Get next term
      const { data: nextTerm } = await supabase
        .from('terms')
        .select('term_id')
        .eq('school_id', schoolId)
        .eq('status', 'upcoming')
        .order('term_order')
        .limit(1)
        .single();

      if (!nextTerm) return;

      // Create carry-forward records
      const carryForwards = unpaidBalances.map(balance => ({
        school_id: schoolId,
        student_id: balance.student_id,
        from_term_id: termId,
        to_term_id: nextTerm.term_id,
        amount: balance.balance_after,
        reason: 'Unpaid balance carry forward',
        processed_at: new Date(),
        created_at: new Date()
      }));

      const { error } = await supabase
        .from('fee_carry_forwards')
        .insert(carryForwards);

      if (error) throw error;

      // Create ledger entries for carry-forward
      const ledgerEntries = unpaidBalances.map(balance => ({
        school_id: schoolId,
        student_id: balance.student_id,
        academic_year_id: balance.academic_year_id,
        term_id: nextTerm.term_id,
        transaction_type: 'carry_forward',
        transaction_date: new Date(),
        amount: balance.balance_after,
        balance_before: 0,
        balance_after: balance.balance_after,
        reference_type: 'term_carry',
        reference_id: termId,
        description: 'Balance carried forward from previous term',
        created_by: userId,
        created_at: new Date()
      }));

      await supabase
        .from('fee_balance_ledger')
        .insert(ledgerEntries);

    } catch (error) {
      console.error('Error creating carry-forwards:', error);
      throw error;
    }
  }

  /**
   * Open a new term
   */
  static async openTerm(schoolId, termId, userId) {
    try {
      // Update term status
      await supabase
        .from('terms')
        .update({
          status: 'active',
          is_current: true,
          updated_at: new Date()
        })
        .eq('term_id', termId);

      // Set previous term as not current
      await supabase
        .from('terms')
        .update({
          is_current: false,
          updated_at: new Date()
        })
        .eq('school_id', schoolId)
        .neq('term_id', termId);

      // Record transition
      await supabase
        .from('term_transitions')
        .insert({
          school_id: schoolId,
          term_id: termId,
          transition_type: 'open',
          triggered_by: userId,
          created_at: new Date()
        });

      return { success: true, termId };
    } catch (error) {
      console.error('Error opening term:', error);
      throw error;
    }
  }

  static async endAcademicYear(schoolId, academicYearId, userId, options = {}) {
    try {
      const { createNextYear = true, promoteStudents = true, carryForwardBalances = true } = options;

      const { data: year } = await supabase
        .from('academic_years')
        .select('*')
        .eq('academic_year_id', academicYearId)
        .eq('school_id', schoolId)
        .single();

      if (!year) throw new Error('Academic year not found');
      if (year.is_closed) throw new Error('Academic year is already closed');

      const { data: terms } = await supabase
        .from('terms')
        .select('*')
        .eq('academic_year_id', academicYearId)
        .eq('school_id', schoolId)
        .neq('status', 'closed');

      const summary = {
        termsClosed: 0,
        studentsPromoted: 0,
        balancesCarriedForward: 0,
        alumniCreated: 0,
        nextYearCreated: false,
      };

      for (const term of terms || []) {
        await supabase
          .from('terms')
          .update({ status: 'closed', is_current: false, updated_at: new Date() })
          .eq('term_id', term.term_id);

        summary.termsClosed++;
      }

      if (promoteStudents) {
        const { data: classes } = await supabase
          .from('classes')
          .select('class_id, class_name, next_class_name')
          .eq('school_id', schoolId)
          .eq('is_deleted', false)
          .order('class_name');

        const { data: activeStudents } = await supabase
          .from('students')
          .select('student_id, first_name, last_name, class_id, class_name, status')
          .eq('school_id', schoolId)
          .eq('is_deleted', false)
          .eq('status', 'active');

        const classMap = new Map((classes || []).map(c => [c.class_name, c]));

        for (const student of activeStudents || []) {
          const currentClass = classMap.get(student.class_name);
          const nextClassName = currentClass?.next_class_name;

          if (nextClassName) {
            const nextClass = classMap.get(nextClassName);
            if (nextClass) {
              await supabase
                .from('students')
                .update({
                  class_id: nextClass.class_id,
                  class_name: nextClassName,
                  updated_at: new Date(),
                })
                .eq('student_id', student.student_id);

              await supabase.from('promotion_decisions').insert({
                student_id: student.student_id,
                academic_year_id: academicYearId,
                from_class_id: student.class_id,
                to_class_id: nextClass.class_id,
                decision: 'promoted',
                decision_date: new Date().toISOString().split('T')[0],
                decided_by: userId,
              });

              summary.studentsPromoted++;
            }
          } else {
            await supabase.from('alumni').insert({
              student_id: student.student_id,
              school_id: schoolId,
              graduation_date: new Date().toISOString().split('T')[0],
              final_class_id: student.class_id,
              created_at: new Date(),
              updated_at: new Date(),
            });

            await supabase
              .from('students')
              .update({ status: 'graduated', updated_at: new Date() })
              .eq('student_id', student.student_id);

            summary.alumniCreated++;
          }
        }
      }

      if (carryForwardBalances) {
        const { data: allStudents } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_deleted', false);

        const { data: feeStructures } = await supabase
          .from('fee_structures')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_deleted', false);

        const { data: payments } = await supabase
          .from('payments')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_deleted', false)
          .in('status', ['paid', 'completed', 'success']);

        const nextYearId = createNextYear ? (await this.createNextAcademicYear(schoolId, year, userId))?.academic_year_id : null;

        let carriedCount = 0;
        for (const student of allStudents || []) {
          const balanceInfo = calculateStudentFeeBalance({ student, feeStructures: feeStructures || [], payments: payments || [] });

          const amount = balanceInfo.balance > 0 ? balanceInfo.balance : (balanceInfo.isOverpaid ? balanceInfo.overpaymentAmount : 0);
          if (amount > 0) {
            await supabase.from('fee_balance_ledger').insert({
              school_id: schoolId,
              student_id: student.student_id,
              academic_year_id: nextYearId || academicYearId,
              balance_after: amount,
              created_at: new Date(),
            });
            carriedCount++;
          }
        }
        summary.balancesCarriedForward = carriedCount;
      }

      await supabase
        .from('academic_years')
        .update({ is_closed: true, is_current: false, updated_at: new Date() })
        .eq('academic_year_id', academicYearId);

      if (createNextYear) {
        const nextYear = await this.createNextAcademicYear(schoolId, year, userId);
        if (nextYear) {
          await supabase
            .from('academic_years')
            .update({ is_current: true, updated_at: new Date() })
            .eq('academic_year_id', nextYear.academic_year_id);

          await supabase
            .from('terms')
            .update({ is_current: false })
            .eq('academic_year_id', nextYear.academic_year_id);

          const { data: firstTerm } = await supabase
            .from('terms')
            .select('term_id')
            .eq('academic_year_id', nextYear.academic_year_id)
            .order('term_order')
            .limit(1)
            .single();

          if (firstTerm) {
            await supabase
              .from('terms')
              .update({ is_current: true, status: 'upcoming' })
              .eq('term_id', firstTerm.term_id);
          }

          summary.nextYearCreated = true;
        }
      }

      await logAuditEvent({ user: { userId, schoolId } }, {
        action: 'academic_year.end',
        entity: 'academic_year',
        entityId: academicYearId,
        description: `Ended academic year ${year.year_label || year.academic_year}`,
        metadata: summary,
      });

      return { success: true, summary, year };
    } catch (error) {
      console.error('Error ending academic year:', error);
      throw error;
    }
  }

  static async createNextAcademicYear(schoolId, currentYear, userId) {
    try {
      const startDate = new Date(currentYear.end_date);
      startDate.setDate(startDate.getDate() + 1);

      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      endDate.setDate(endDate.getDate() - 1);

      const nextYearLabel = `${startDate.getFullYear()}/${endDate.getFullYear()}`;

      const { data: existing } = await supabase
        .from('academic_years')
        .select('academic_year_id')
        .eq('school_id', schoolId)
        .eq('academic_year', nextYearLabel)
        .single();

      if (existing) return existing;

      const { data: nextYear, error } = await supabase
        .from('academic_years')
        .insert({
          school_id: schoolId,
          academic_year: nextYearLabel,
          year_label: nextYearLabel,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          is_current: false,
          is_closed: false,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;

      const { data: currentTerms } = await supabase
        .from('terms')
        .select('term_name, term_order, start_date, end_date')
        .eq('academic_year_id', currentYear.academic_year_id)
        .eq('school_id', schoolId)
        .order('term_order');

      if (currentTerms?.length) {
        const termRecords = currentTerms.map((term, index) => {
          const termStart = new Date(startDate);
          const termEnd = new Date(startDate);
          const duration = (new Date(term.end_date) - new Date(term.start_date)) / (1000 * 60 * 60 * 24);
          termEnd.setDate(termStart.getDate() + duration);

          return {
            school_id: schoolId,
            academic_year_id: nextYear.academic_year_id,
            term_name: term.term_name,
            term_order: index + 1,
            start_date: termStart.toISOString().split('T')[0],
            end_date: termEnd.toISOString().split('T')[0],
            status: 'upcoming',
            is_current: false,
            created_at: new Date(),
            updated_at: new Date(),
          };
        });

        await supabase.from('terms').insert(termRecords);
      }

      return nextYear;
    } catch (error) {
      console.error('Error creating next academic year:', error);
      return null;
    }
  }
}

// =====================================================
// STUDENT ENROLLMENT SERVICE
// =====================================================

export class StudentEnrollmentService {
  /**
   * Get student enrollment history
   */
  static async getEnrollmentHistory(studentId) {
    try {
      const { data: enrollments, error } = await supabase
        .from('student_enrollments')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_deleted', false)
        .order('enrollment_date', { ascending: false });

      if (error) throw error;
      if (!enrollments?.length) return [];

      const classIds = [...new Set(enrollments.map(e => e.class_id).filter(Boolean))];
      const yearIds = [...new Set(enrollments.map(e => e.academic_year_id).filter(Boolean))];
      const termIds = [...new Set(enrollments.map(e => e.term_id).filter(Boolean))];

      const [classesResult, yearsResult, termsResult] = await Promise.all([
        classIds.length ? supabase.from('classes').select('class_id, class_name').in('class_id', classIds) : { data: [] },
        yearIds.length ? supabase.from('academic_years').select('academic_year_id, year_label').in('academic_year_id', yearIds) : { data: [] },
        termIds.length ? supabase.from('terms').select('term_id, term_name').in('term_id', termIds) : { data: [] }
      ]);

      if (classesResult.error) throw classesResult.error;
      if (yearsResult.error) throw yearsResult.error;
      if (termsResult.error) throw termsResult.error;

      const classMap = new Map((classesResult.data || []).map(c => [c.class_id, c]));
      const yearMap = new Map((yearsResult.data || []).map(y => [y.academic_year_id, y]));
      const termMap = new Map((termsResult.data || []).map(t => [t.term_id, t]));

      return enrollments.map(e => ({
        ...e,
        classes: classMap.get(e.class_id) || null,
        academic_years: yearMap.get(e.academic_year_id) || null,
        terms: termMap.get(e.term_id) || null
      }));
    } catch (error) {
      console.error('Error getting enrollment history:', error);
      return [];
    }
  }

  /**
   * Get current enrollment
   */
  static async getCurrentEnrollment(studentId) {
    try {
      const { data: enrollments, error } = await supabase
        .from('student_enrollments')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_deleted', false);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42703') return null;
        throw error;
      }

      if (!enrollments || !enrollments.length) return null;

      const current = enrollments.find(r => r.is_current ?? true) || enrollments[0];

      const [classResult, yearResult] = await Promise.all([
        current.class_id ? supabase.from('classes').select('class_name').eq('class_id', current.class_id).single() : { data: null },
        current.academic_year_id ? supabase.from('academic_years').select('year_label').eq('academic_year_id', current.academic_year_id).single() : { data: null }
      ]);

      if (classResult.error && classResult.error.code !== 'PGRST116') throw classResult.error;
      if (yearResult.error && yearResult.error.code !== 'PGRST116') throw yearResult.error;

      return {
        ...current,
        classes: classResult.data || null,
        academic_years: yearResult.data || null
      };
    } catch (error) {
      console.error('Error getting current enrollment:', error);
      return null;
    }
  }

  /**
   * Create enrollment from legacy data
   */
  static async initializeFromLegacy(schoolId) {
    try {
      // Get students with class assignments
      const { data: students } = await supabase
        .from('students')
        .select('student_id, class_id, admission_date, created_at')
        .eq('school_id', schoolId)
        .neq('is_deleted', true)
        .not('class_id', 'is', null);

      if (!students?.length) return;

      // Get academic year mappings
      const { data: mappings } = await supabase
        .from('class_academic_year_mapping')
        .select('class_id, academic_year_id')
        .in('class_id', students.map(s => s.class_id));

      const mappingMap = new Map(
        mappings?.map(m => [m.class_id, m.academic_year_id]) || []
      );

      // Create enrollment records
      const enrollments = students.map(student => ({
        student_id: student.student_id,
        class_id: student.class_id,
        academic_year_id: mappingMap.get(student.class_id),
        enrollment_date: student.admission_date || student.created_at,
        status: 'active',
        enrollment_type: 'regular',
        is_current: true,
        created_at: new Date(),
        updated_at: new Date()
      })).filter(e => e.academic_year_id); // Only create if we have academic year

      if (enrollments.length) {
        const { error } = await supabase
          .from('student_enrollments')
          .upsert(enrollments, { onConflict: 'student_id,is_current' });

        if (error) throw error;
      }

      return enrollments;
    } catch (error) {
      console.error('Error initializing enrollments:', error);
      throw error;
    }
  }

  /**
   * Create new enrollment
   */
  static async createEnrollment(enrollmentData) {
    try {
      const { data, error } = await supabase
        .from('student_enrollments')
        .insert({
          ...enrollmentData,
          created_at: new Date(),
          updated_at: new Date()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating enrollment:', error);
      throw error;
    }
  }
}

// =====================================================
// FEE BALANCE SERVICE
// =====================================================

export class FeeBalanceService {
  /**
   * Get student balance from ledger (new system)
   */
  static async getStudentBalance(schoolId, studentId, academicYearId = null) {
    try {
      let query = supabase
        .from('fee_balance_ledger')
        .select('balance_after')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (academicYearId) {
        query = query.eq('academic_year_id', academicYearId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return null;
      }
      return parseFloat(data[0].balance_after) || 0;
    } catch (error) {
      console.error('Error getting student balance:', error);
      return null;
    }
  }

  /**
   * Get student balance with fallback to legacy system
   */
  static async getStudentBalanceWithFallback(schoolId, studentId) {
    // Try new system first
    const newBalance = await this.getStudentBalance(schoolId, studentId);
    if (newBalance !== null) return newBalance;

    // Fallback to legacy calculation
    try {
      const { data } = await supabase
        .from('invoices')
        .select('balance')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .neq('is_deleted', true);

      return data?.reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0) || 0;
    } catch (error) {
      console.error('Error getting legacy balance:', error);
      return 0;
    }
  }

  /**
   * Record transaction in ledger
   */
  static async recordTransaction(params) {
    const {
      schoolId,
      studentId,
      academicYearId,
      termId,
      type,
      amount,
      referenceType,
      referenceId,
      description,
      userId
    } = params;

    try {
      // Get current balance
      const currentBalance = await this.getStudentBalance(schoolId, studentId, academicYearId);

      // Calculate new balance
      const amountValue = parseFloat(amount);
      const newBalance = type === 'payment'
        ? currentBalance - amountValue
        : currentBalance + amountValue;

      // Insert ledger entry
      const { data, error } = await supabase
        .from('fee_balance_ledger')
        .insert({
          school_id: schoolId,
          student_id: studentId,
          academic_year_id: academicYearId,
          term_id: termId,
          transaction_type: type,
          transaction_date: new Date(),
          amount: type === 'payment' ? -amountValue : amountValue,
          balance_before: currentBalance,
          balance_after: newBalance,
          reference_type: referenceType,
          reference_id: referenceId,
          description: description || '',
          created_by: userId,
          created_at: new Date()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction ledger for student
   */
  static async getTransactionLedger(schoolId, studentId, options = {}) {
    try {
      const { academicYearId, termId, limit = 50, offset = 0 } = options;

      let query = supabase
        .from('fee_balance_ledger')
        .select('*')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (academicYearId) {
        query = query.eq('academic_year_id', academicYearId);
      }

      if (termId) {
        query = query.eq('term_id', termId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data?.length) return [];

      const termIds = [...new Set(data.map(r => r.term_id).filter(Boolean))];
      const yearIds = [...new Set(data.map(r => r.academic_year_id).filter(Boolean))];
      const createdByIds = [...new Set(data.map(r => r.created_by).filter(Boolean))];

      const [termsResult, yearsResult, usersResult] = await Promise.all([
        termIds.length ? supabase.from('terms').select('term_id, term_name').in('term_id', termIds) : { data: [] },
        yearIds.length ? supabase.from('academic_years').select('academic_year_id, year_label').in('academic_year_id', yearIds) : { data: [] },
        createdByIds.length ? supabase.from('users').select('user_id, full_name').in('user_id', createdByIds) : { data: [] }
      ]);

      if (termsResult.error) throw termsResult.error;
      if (yearsResult.error) throw yearsResult.error;
      if (usersResult.error) throw usersResult.error;

      const termMap = new Map((termsResult.data || []).map(t => [t.term_id, t]));
      const yearMap = new Map((yearsResult.data || []).map(y => [y.academic_year_id, y]));
      const userMap = new Map((usersResult.data || []).map(u => [u.user_id, u]));

      return data.map(row => ({
        ...row,
        terms: termMap.get(row.term_id) || null,
        academic_years: yearMap.get(row.academic_year_id) || null,
        users: userMap.get(row.created_by) || null
      }));
    } catch (error) {
      console.error('Error getting transaction ledger:', error);
      return [];
    }
  }
}

// =====================================================
// DUAL WRITE SERVICE
// =====================================================

export class DualWriteService {
  /**
   * Create invoice in both old and new systems
   */
  static async createInvoice(invoiceData) {
    const client = await supabase.rpc('begin_transaction');

    try {
      // 1. Create in legacy system
      const { data: legacyInvoice, error: legacyError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (legacyError) throw legacyError;

      // 2. Try to create in new system
      try {
        const academicYear = await AcademicYearService.getCurrentYear(invoiceData.school_id);
        const currentTerm = await TermService.getCurrentTerm(invoiceData.school_id);

        if (academicYear) {
          await FeeBalanceService.recordTransaction({
            schoolId: invoiceData.school_id,
            studentId: invoiceData.student_id,
            academicYearId: academicYear.academic_year_id,
            termId: currentTerm?.term_id,
            type: 'charge',
            amount: invoiceData.total,
            referenceType: 'invoice',
            referenceId: legacyInvoice.invoice_id,
            description: 'Invoice created',
            userId: invoiceData.created_by
          });
        }
      } catch (newSystemError) {
        // Log error but don't fail the operation
        console.error('Error in new system ledger:', newSystemError);
      }

      return legacyInvoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Record payment in both old and new systems
   */
  static async recordPayment(paymentData) {
    const client = await supabase.rpc('begin_transaction');

    try {
      // 1. Create in legacy system
      const { data: legacyPayment, error: legacyError } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (legacyError) throw legacyError;

      // 2. Update legacy invoice balance
      if (paymentData.invoice_id) {
        await supabase.rpc('update_invoice_balance', {
          invoice_id: paymentData.invoice_id,
          payment_amount: paymentData.amount
        });
      }

      // 3. Try to record in new system
      try {
        const academicYear = await AcademicYearService.getCurrentYear(paymentData.school_id);
        const currentTerm = await TermService.getCurrentTerm(paymentData.school_id);

        if (academicYear) {
          await FeeBalanceService.recordTransaction({
            schoolId: paymentData.school_id,
            studentId: paymentData.student_id,
            academicYearId: academicYear.academic_year_id,
            termId: currentTerm?.term_id,
            type: 'payment',
            amount: paymentData.amount,
            referenceType: 'payment',
            referenceId: legacyPayment.payment_id,
            description: 'Payment recorded',
            userId: paymentData.received_by_user_id
          });
        }
      } catch (newSystemError) {
        // Log error but don't fail the operation
        console.error('Error in new system ledger:', newSystemError);
      }

      return legacyPayment;
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }
}

// =====================================================
// PROMOTION SERVICE
// =====================================================

export class PromotionService {
  /**
   * Get promotion rules for a school
   */
  static async getPromotionRules(schoolId) {
    try {
      const { data, error } = await supabase
        .from('promotion_rules')
        .select('*')
        .eq('school_id', schoolId)
        .neq('is_deleted', true)
        .order('from_class_pattern');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting promotion rules:', error);
      return [];
    }
  }

  /**
   * Check if student is eligible for promotion
   */
  static async checkPromotionEligibility(studentId, fromClassId) {
    try {
      // Get student performance (this would need grade tables)
      // For now, return basic eligibility
      const enrollment = await StudentEnrollmentService.getCurrentEnrollment(studentId);

      if (!enrollment) return { eligible: false, reason: 'No current enrollment' };

      const rules = await this.getPromotionRules(enrollment.school_id);

      // Find applicable rule
      const applicableRule = rules.find(rule =>
        enrollment.class_name?.includes(rule.from_class_pattern) ||
        enrollment.class_name === rule.from_class_pattern
      );

      if (!applicableRule) {
        return { eligible: true, rule: null, reason: 'No specific rule, auto-eligible' };
      }

      // Check minimum percentage (would need grade data)
      // For now, assume eligible
      return {
        eligible: true,
        rule: applicableRule,
        reason: 'Meets promotion criteria'
      };
    } catch (error) {
      console.error('Error checking promotion eligibility:', error);
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  }

  /**
   * Promote student
   */
  static async promoteStudent(studentId, toClassId, approvedBy, reason = null) {
    try {
      const currentEnrollment = await StudentEnrollmentService.getCurrentEnrollment(studentId);
      if (!currentEnrollment) {
        throw new Error('Student has no current enrollment');
      }

      // Create promotion decision record
      const { data: decision, error: decisionError } = await supabase
        .from('promotion_decisions')
        .insert({
          student_id: studentId,
          from_enrollment_id: currentEnrollment.enrollment_id,
          to_class_id: toClassId,
          academic_year_id: currentEnrollment.academic_year_id,
          decision: 'promoted',
          reason: reason || 'Academic promotion',
          approved_by: approvedBy,
          approved_at: new Date(),
          created_at: new Date()
        })
        .select()
        .single();

      if (decisionError) throw decisionError;

      // Update current enrollment as not current
      try {
        await supabase
          .from('student_enrollments')
          .update({
            is_current: false,
            status: 'promoted',
            updated_at: new Date()
          })
          .eq('enrollment_id', currentEnrollment.enrollment_id);
      } catch (updateError) {
        console.warn('Could not update enrollment status:', updateError.message);
      }

      // Create new enrollment
      const newEnrollment = await StudentEnrollmentService.createEnrollment({
        student_id: studentId,
        class_id: toClassId,
        academic_year_id: currentEnrollment.academic_year_id,
        enrollment_date: new Date(),
        updated_at: new Date()
      });

      return { decision, newEnrollment };
    } catch (error) {
      console.error('Error promoting student:', error);
      throw error;
    }
  }
}

// =====================================================
// PERMISSION SERVICE
// =====================================================

export class PermissionService {
  static PERMISSIONS = {
    // Academic Management
    'academic.view': 'View academic calendar',
    'academic.manage': 'Create/edit academic years and terms',
    'term.close': 'Close academic terms',
    'term.open': 'Open new terms',

    // Student Management
    'students.view': 'View student information',
    'students.manage': 'Create/edit student records',
    'enrollment.view': 'View enrollment history',
    'enrollment.manage': 'Manage student enrollments',
    'promotion.view': 'View promotion status',
    'promotion.approve': 'Approve student promotions',

    // Financial Management
    'finance.view': 'View financial data',
    'finance.create_payments': 'Record payments',
    'finance.adjust_balances': 'Adjust student balances',
    'finance.approve_adjustments': 'Approve balance adjustments',
    'ledger.view': 'View transaction ledger',

    // Reporting
    'reports.view': 'View reports',
    'reports.financial': 'View financial reports',
    'reports.academic': 'View academic reports'
  };

  static ROLE_PERMISSIONS = {
    superadmin: ['*'],
    admin: [
      'academic.manage', 'term.close', 'term.open',
      'students.manage', 'enrollment.manage', 'promotion.approve',
      'finance.approve_adjustments', 'ledger.view',
      'reports.view', 'reports.financial', 'reports.academic'
    ],
    accountant: [
      'finance.view', 'finance.create_payments', 'finance.adjust_balances',
      'ledger.view', 'reports.financial'
    ],
    teacher: [
      'students.view', 'enrollment.view', 'promotion.view',
      'reports.view'
    ]
  };

  /**
   * Check if user has permission
   */
  static async checkPermission(userId, permission, resourceId = null) {
    try {
      // Get user with role
      const { data: user, error } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Super admin bypass
      if (user.role === 'superadmin') return true;

      // Check role permissions
      const rolePermissions = this.ROLE_PERMISSIONS[user.role] || [];
      if (rolePermissions.includes('*') || rolePermissions.includes(permission)) {
        return await this.checkResourceAccess(user, permission, resourceId);
      }

      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Check resource-level access
   */
  static async checkResourceAccess(user, permission, resourceId) {
    if (!resourceId) return true;

    try {
      // Get resource school_id
      let resourceSchoolId = null;

      if (permission.includes('students.') || permission.includes('enrollment.')) {
        const { data } = await supabase
          .from('students')
          .select('school_id')
          .eq('student_id', resourceId)
          .single();
        resourceSchoolId = data?.school_id;
      } else if (permission.includes('academic.') || permission.includes('term.')) {
        const { data } = await supabase
          .from('terms')
          .select('school_id')
          .eq('term_id', resourceId)
          .single();
        resourceSchoolId = data?.school_id;
      }

      return resourceSchoolId === user.school_id;
    } catch (error) {
      console.error('Error checking resource access:', error);
      return false;
    }
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(userId) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (!user) return [];

      if (user.role === 'superadmin') {
        return Object.keys(this.PERMISSIONS);
      }

      return this.ROLE_PERMISSIONS[user.role] || [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }
}