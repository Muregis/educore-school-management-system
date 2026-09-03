import { supabase } from '../config/supabaseClient.js';
import { logAuditEvent } from '../helpers/audit.logger.js';
import {
  getOpeningBalanceImpact,
  getStudentBaseFee,
  getStudentTransportFee,
  getStudentLunchFee,
  getStudentBreakfastFee,
  getBestDiscount,
  calculateFeeWithDiscount,
} from './feeBalanceCalculator.js';

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

export class BillingService {
  static async selectBillingContext(schoolId, termId = null, academicYearId = null) {
    let academicYear = null;
    if (academicYearId) {
      const { data } = await supabase
        .from('academic_years')
        .select('*')
        .eq('academic_year_id', academicYearId)
        .eq('school_id', schoolId)
        .single();
      academicYear = data;
    } else {
      const { data } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single();
      if (!data) {
        const { data: latest } = await supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', schoolId)
          .order('academic_year_id', { ascending: false })
          .limit(1)
          .single();
        academicYear = latest;
      } else {
        academicYear = data;
      }
    }

    if (!academicYear) {
      throw new Error('No academic year found for school');
    }

    let term = null;
    if (termId) {
      const { data } = await supabase
        .from('terms')
        .select('*')
        .eq('term_id', termId)
        .eq('school_id', schoolId)
        .single();
      term = data;
    } else {
      const { data } = await supabase
        .from('terms')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_year_id', academicYear.academic_year_id)
        .eq('is_current', true)
        .single();
      if (!data) {
        const { data: firstTerm } = await supabase
          .from('terms')
          .select('*')
          .eq('school_id', schoolId)
          .eq('academic_year_id', academicYear.academic_year_id)
          .order('term_order', { ascending: true })
          .limit(1)
          .single();
        term = firstTerm;
      } else {
        term = data;
      }
    }

    if (!term) {
      throw new Error('No term found for academic year');
    }

    return { academicYear, term };
  }

  static async getBillingEligibleStudents(schoolId) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active')
      .order('student_id', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async getFeeStructure(schoolId, className, termName) {
    const { data, error } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('school_id', schoolId)
      .eq('class_name', className)
      .eq('term', termName)
      .eq('is_deleted', false)
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  }

  static async getActiveStudentServices(schoolId, studentId, term) {
    const { data, error } = await supabase
      .from('student_services')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .lte('start_date', term.end_date)
      .or(`end_date.is.null,end_date.gte.${term.start_date}`);

    if (error) throw error;
    return data || [];
  }

  static async getStudentDiscounts(schoolId, studentId) {
    const { data, error } = await supabase
      .from('student_discounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  }

  static async getSchoolSettings(schoolId, keys) {
    const { data, error } = await supabase
      .from('school_settings')
      .select('setting_key, setting_value')
      .eq('school_id', schoolId)
      .in('setting_key', keys);

    if (error) throw error;
    const map = {};
    for (const row of data || []) {
      map[row.setting_key] = toNumber(row.setting_value);
    }
    return map;
  }

  static async getLastLedgerBalance(schoolId, studentId) {
    const { data, error } = await supabase
      .from('fee_balance_ledger')
      .select('balance_after')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('ledger_id', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0]?.balance_after || 0;
  }

  static async insertLedgerEntries(schoolId, studentId, academicYearId, termId, sourceItems, userId) {
    const runningBalance = await this.getLastLedgerBalance(schoolId, studentId);
    const entries = [];
    let currentBalance = toNumber(runningBalance);

    for (const item of sourceItems) {
      const balanceBefore = round2(currentBalance);
      currentBalance += toNumber(item.amount);
      const balanceAfter = round2(currentBalance);

      entries.push({
        school_id: schoolId,
        student_id: studentId,
        academic_year_id: academicYearId,
        term_id: termId,
        transaction_type: 'charge',
        transaction_date: new Date().toISOString().split('T')[0],
        amount: round2(toNumber(item.amount)),
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_type: item.reference_type,
        reference_id: item.reference_id || null,
        description: item.description,
        created_by: userId,
        is_deleted: false,
        created_at: new Date().toISOString(),
      });
    }

    const created = [];
    for (const entry of entries) {
      const { data, error } = await supabase
        .from('fee_balance_ledger')
        .insert(entry)
        .select('ledger_id')
        .single();

      if (error) {
        console.error('Ledger insert error:', error);
        throw new Error(`Failed to insert ledger entry: ${error.message}`);
      }
      created.push({ ...entry, ledger_id: data.ledger_id });
    }

    return created;
  }

  static async computeStudentBilling(schoolId, student, term, academicYear, settings) {
    const className = student.class_name;
    const feeStructure = await this.getFeeStructure(schoolId, className, term.term_name);

    const tuition = feeStructure ? toNumber(feeStructure.tuition) : 0;
    const activity = feeStructure ? toNumber(feeStructure.activity) : 0;
    const misc = feeStructure ? toNumber(feeStructure.misc) : 0;

    const transportCharge = getStudentTransportFee(student);
    const lunchCharge = getStudentLunchFee(student, settings);

    const baseFee = tuition + activity + misc;
    const discounts = await this.getStudentDiscounts(schoolId, student.student_id);
    const discountResult = calculateFeeWithDiscount({
      baseFee,
      tuition,
      transportFee: transportCharge,
      lunchFee: lunchCharge,
      breakfastFee: 0,
      openingBalance: 0,
      discounts,
    });

    const discountAmount = discountResult.discountAmount;
    const carryForward = getOpeningBalanceImpact(student);

    const totalCharge = round2(
      tuition + activity + misc + lunchCharge + transportCharge - discountAmount + carryForward
    );

    const sourceItems = [
      {
        type: 'fee_structure',
        reference_type: 'fee_structure',
        reference_id: feeStructure?.fee_structure_id || null,
        amount: round2(tuition + activity + misc),
        description: `Fee structure - ${term.term_name}`,
      },
    ];

    if (transportCharge > 0) {
      sourceItems.push({
        type: 'student_service',
        reference_type: 'transport',
        reference_id: null,
        amount: round2(transportCharge),
        description: `Transport service - ${term.term_name}`,
      });
    }

    if (lunchCharge > 0) {
      sourceItems.push({
        type: 'student_service',
        reference_type: 'lunch',
        reference_id: null,
        amount: round2(lunchCharge),
        description: `Lunch service - ${term.term_name}`,
      });
    }

    if (discountAmount > 0) {
      sourceItems.push({
        type: 'discount',
        reference_type: 'discount',
        reference_id: null,
        amount: -round2(discountAmount),
        description: `Discount: ${discountResult.discountType || 'custom'}`,
      });
    }

    if (carryForward !== 0) {
      sourceItems.push({
        type: 'carry_forward',
        reference_type: 'carry_forward',
        reference_id: null,
        amount: round2(carryForward),
        description: carryForward > 0 ? 'Carry forward (owing)' : 'Carry forward (credit)',
      });
    }

    return {
      student_id: student.student_id,
      components: {
        tuition_charge: round2(tuition),
        activity_charge: round2(activity),
        misc_charge: round2(misc),
        lunch_charge: round2(lunchCharge),
        transport_charge: round2(transportCharge),
      },
      discount_amount: round2(discountAmount),
      carry_forward: round2(carryForward),
      total_charge,
      source_items: sourceItems,
    };
  }

  static async runBillingForStudent(schoolId, student, term, academicYear, settings, userId) {
    const idempotencyKey = generateIdempotencyKey(schoolId, student.student_id, term.term_id);

    return withIdempotencyGuard(idempotencyKey, 24 * 60 * 60 * 1000, async () => {
      const billing = await this.computeStudentBilling(schoolId, student, term, academicYear, settings);

      if (billing.source_items.length === 0) {
        return { status: 'skipped', reason: 'no_charges' };
      }

      const sortedItems = billing.source_items.sort((a, b) => {
        const order = { fee_structure: 1, student_service: 2, discount: 3, waiver: 4, carry_forward: 5, adjustment: 6 };
        return (order[a.type] || 99) - (order[b.type] || 99);
      });

      const entries = await this.insertLedgerEntries(
        schoolId,
        student.student_id,
        academicYear.academic_year_id,
        term.term_id,
        sortedItems,
        userId
      );

      return {
        status: 'billed',
        total_charge: billing.total_charge,
        components: billing.components,
        discount_amount: billing.discount_amount,
        carry_forward: billing.carry_forward,
        entries_created: entries.length,
      };
    });
  }

  static async runBillingProcess(schoolId, termId = null, academicYearId = null, userId = null) {
    const context = await this.selectBillingContext(schoolId, termId, academicYearId);
    const term = context.term;
    const academicYear = context.academicYear;

    const students = await this.getBillingEligibleStudents(schoolId);
    if (students.length === 0) {
      return { processed: 0, errors: [], details: [] };
    }

    const settings = await this.getSchoolSettings(schoolId, [
      'lunch_daily_rate',
      'lunch_days',
      'breakfast_daily_rate',
      'breakfast_days',
    ]);

    const results = { processed: 0, errors: [], details: [] };

    for (const student of students) {
      try {
        const result = await this.runBillingForStudent(schoolId, student, term, academicYear, settings, userId);
        results.processed += 1;
        results.details.push({
          student_id: student.student_id,
          ...result,
        });
      } catch (error) {
        results.errors.push({
          student_id: student.student_id,
          error: error.message,
        });
      }
    }

    if (userId) {
      try {
        await logAuditEvent(
          { user: { userId, schoolId } },
          {
            action: 'billing.run',
            entity: 'fee_balance_ledger',
            entityId: null,
            description: `Billing run for term ${term.term_name}`,
            metadata: {
              processed: results.processed,
              errors: results.errors.length,
              term_id: term.term_id,
              academic_year_id: academicYear.academic_year_id,
            },
          }
        );
      } catch (auditError) {
        console.error('Billing audit logging failed:', auditError.message);
      }
    }

    return results;
  }

  static async dryRunBilling(schoolId, termId = null, academicYearId = null) {
    const context = await this.selectBillingContext(schoolId, termId, academicYearId);
    const term = context.term;
    const academicYear = context.academicYear;

    const students = await this.getBillingEligibleStudents(schoolId);
    if (students.length === 0) {
      return { processed: 0, details: [] };
    }

    const settings = await this.getSchoolSettings(schoolId, [
      'lunch_daily_rate',
      'lunch_days',
      'breakfast_daily_rate',
      'breakfast_days',
    ]);

    const details = [];
    for (const student of students) {
      const billing = await this.computeStudentBilling(schoolId, student, term, academicYear, settings);
      details.push({
        student_id: student.student_id,
        ...billing,
      });
    }

    return {
      processed: details.length,
      term: term.term_name,
      academic_year: academicYear.year_label,
      details,
    };
  }
}

export default BillingService;
