import { database } from "../config/db.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
import { supabase } from "../config/supabaseClient.js";

// Student Ledger Service for fee balance tracking
export class LedgerService {
  // Generate receipt number
  static generateReceiptNumber() {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `REC-${date}-${random}`;
  }

  // Helper: Get opening balance impact
  static getOpeningBalanceImpact(student) {
    const amount = Number(student?.opening_balance || 0);
    return student?.opening_balance_type === "credit" ? -amount : amount;
  }

  // Helper: Get student extra charges (transport, lunch, breakfast)
  static getStudentExtraCharges(student) {
    const transportBaseFee = Number(student?.transport_base_fee || 0);
    // Use full amount as inserted (no percentage reduction)
    const transportFee = transportBaseFee;

    const lunchFee = student?.lunch_enabled
      ? Number(student?.lunch_daily_rate || 0) * Number(student?.lunch_days || 0)
      : 0;

    const breakfastFee = student?.breakfast_enabled
      ? Number(student?.breakfast_daily_rate || 0) * Number(student?.breakfast_days || 0)
      : 0;

    return transportFee + lunchFee + breakfastFee;
  }

  // Helper: Apply student discount
  // IMPORTANT: Discount applies ONLY to tuition portion, not activity/misc/transport/meals/opening balance
  static applyStudentDiscount(baseFee, student, extraCharges = 0, openingBalanceImpact = 0, tuitionBase = null) {
    const discountValue = Number(student?.discount_value || 0);
    if (!discountValue) return baseFee + extraCharges + openingBalanceImpact;
    const isPercentage = student?.discount_is_percentage !== false;
    // CRITICAL: Discount applies ONLY to tuition portion, not activity/misc
    const discountableAmount = tuitionBase !== null ? tuitionBase : baseFee;
    const discountAmount = isPercentage ? (discountableAmount * discountValue) / 100 : discountValue;
    const netBaseFee = Math.max(0, baseFee - discountAmount);
    // Add back non-discounted components
    return netBaseFee + extraCharges + openingBalanceImpact;
  }

  // Helper: Get student with all fee-related fields
  static async getStudentWithFeeDetails(schoolId, studentId) {
    const { data: student, error } = await supabase
      .from('students')
      .select('student_id, opening_balance, opening_balance_type, transport_direction, transport_base_fee, lunch_enabled, lunch_daily_rate, lunch_days, breakfast_enabled, breakfast_daily_rate, breakfast_days, discount_type, discount_value, discount_is_percentage')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();
    
    if (error || !student) return null;
    return student;
  }

  // Record a charge (fee assessment) in student ledger
  static async recordCharge(schoolId, studentId, amount, description, referenceType = null, referenceId = null, includeStudentFactors = true, tuitionAmount = null) {
    try {
      // Get current balance using Supabase
      const { data: currentEntries } = await database.query('student_ledger', {
        select: 'balance_after',
        where: { student_id: studentId },
        schoolId: schoolId,
        order: { column: 'ledger_id', ascending: false },
        limit: 1
      });

      const previousBalance = currentEntries?.[0]?.balance_after || 0;
      let finalAmount = Number(amount);

      // Add student-specific factors if requested
      if (includeStudentFactors) {
        const student = await this.getStudentWithFeeDetails(schoolId, studentId);
        if (student) {
          const openingBalanceImpact = this.getOpeningBalanceImpact(student);
          const extraCharges = this.getStudentExtraCharges(student);
          finalAmount = this.applyStudentDiscount(finalAmount, student, extraCharges, openingBalanceImpact, tuitionAmount);
        }
      }

      const newBalance = previousBalance + finalAmount;

      // Insert ledger entry using Supabase
      const { data: result } = await database.insert('student_ledger', {
        school_id: schoolId,
        student_id: studentId,
        transaction_type: 'charge',
        amount: finalAmount,
        balance_after: newBalance,
        reference_type: referenceType,
        reference_id: referenceId,
        description: description
      });

      return result[0]?.ledger_id;
    } catch (error) {
      console.error('Ledger charge error:', error);
      throw new Error(`Failed to record charge: ${error.message}`);
    }
  }

  // Record a payment in student ledger
  static async recordPayment(schoolId, studentId, amount, description, paymentId, req) {
    try {
      const numericAmount = Number(amount);

      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'student_ledger');

      if (!tables || !tables.length) {
        console.warn('student_ledger table does not exist - payment not recorded in ledger');
        return { receiptNumber: null, newBalance: null };
      }

      const { data: currentEntries } = await database.query('student_ledger', {
        select: 'balance_after',
        where: { student_id: studentId },
        schoolId: schoolId,
        order: { column: 'ledger_id', ascending: false },
        limit: 1
      });

      const previousBalance = currentEntries?.[0]?.balance_after || 0;
      const newBalance = previousBalance - numericAmount;
      const receiptNumber = this.generateReceiptNumber();

      const { data: result } = await database.insert('student_ledger', {
        school_id: schoolId,
        student_id: studentId,
        transaction_type: 'payment',
        amount: numericAmount,
        balance_after: newBalance,
        reference_type: 'payment',
        reference_id: paymentId,
        description: description,
        receipt_number: receiptNumber
      });

      if (req) {
        try {
          await logAuditEvent(req, 'payment.create', {
            entityId: paymentId,
            entityType: 'payment',
            description: `Payment recorded: ${numericAmount} for student ${studentId} - Receipt: ${receiptNumber}`,
            newValues: { studentId, amount: numericAmount, receiptNumber, balanceAfter: newBalance }
          });
        } catch (auditErr) {
          console.warn('Ledger audit logging failed:', auditErr.message);
        }
      }

      return { ledgerId: result?.[0]?.ledger_id, receiptNumber, newBalance };
    } catch (error) {
      console.error('Ledger payment error:', error);
      return { receiptNumber: null, newBalance: null };
    }
  }

  // Get student balance
  static async getStudentBalance(schoolId, studentId) {
    const { data: entries } = await database.query('student_ledger', {
      select: 'balance_after',
      where: { student_id: studentId },
      schoolId: schoolId,
      order: { column: 'ledger_id', ascending: false },
      limit: 1
    });
    return entries?.[0]?.balance_after || 0;
  }

  // Get student ledger entries
  static async getStudentLedger(schoolId, studentId, limit = 50, offset = 0) {
    const { data: entries } = await database.query('student_ledger', {
      schoolId: schoolId,
      where: { student_id: studentId },
      order: { column: 'created_at', ascending: false },
      limit: limit,
      offset: offset
    });
    return entries || [];
  }

  // Get fee statement for student
  static async getFeeStatement(schoolId, studentId, term = null) {
    try {
      // Use RPC for complex query with joins
      const { data: rows } = await database.rpc('get_fee_statement', {
        p_school_id: schoolId,
        p_student_id: studentId,
        p_term: term
      });

      // Use RPC for summary calculation
      const { data: summary } = await database.rpc('get_fee_summary', {
        p_school_id: schoolId,
        p_student_id: studentId
      });

      return {
        student: rows?.[0] ? {
          studentId: rows[0].student_id,
          firstName: rows[0].first_name,
          lastName: rows[0].last_name,
          admissionNumber: rows[0].admission_number
        } : null,
        transactions: rows || [],
        summary: {
          totalCharges: Number(summary?.[0]?.total_charges) || 0,
          totalPayments: Number(summary?.[0]?.total_payments) || 0,
          currentBalance: Number(summary?.[0]?.current_balance) || 0
        }
      };
    } catch (error) {
      console.error('Fee statement error:', error);
      // Fallback to simpler query if RPC not available
      const { data: rows } = await database.query('student_ledger', {
        schoolId: schoolId,
        where: { student_id: studentId },
        order: { column: 'created_at', ascending: false }
      });

      const charges = rows?.filter(t => t.transaction_type === 'charge').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const payments = rows?.filter(t => t.transaction_type === 'payment').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const balance = rows?.[0]?.balance_after || 0;

      return {
        student: null,
        transactions: rows || [],
        summary: { totalCharges: charges, totalPayments: payments, currentBalance: balance }
      };
    }
  }

  // Create fee assessment for multiple students
  static async assessFeesForClass(schoolId, classId, feeStructureId, term, academicYear) {
    try {
      // Get students in class using Supabase
      const { data: students } = await database.query('students', {
        select: 'student_id',
        where: { class_id: classId, is_deleted: false },
        schoolId: schoolId
      });

      // Get fee structure using Supabase
      const { data: feeStructures } = await database.query('fee_structures', {
        where: { fee_structure_id: feeStructureId, is_deleted: false },
        schoolId: schoolId,
        limit: 1
      });

      const feeStructure = feeStructures?.[0];
      if (!feeStructure) {
        throw new Error('Fee structure not found');
      }

      // Get fee items for this structure using Supabase
      const { data: feeItems } = await database.query('fee_items', {
        where: { fee_structure_id: feeStructureId },
        schoolId: schoolId
      });

      // Assess fees for each student
      const results = [];
      for (const student of students || []) {
        let totalAmount = 0;
        let tuitionAmount = 0;
        const itemNames = [];
        for (const feeItem of feeItems || []) {
          if (!feeItem.is_optional) {
            totalAmount += Number(feeItem.amount);
            itemNames.push(feeItem.item_name);
            if (feeItem.item_type === 'tuition') {
              tuitionAmount += Number(feeItem.amount);
            }
          }
        }

        if (totalAmount > 0) {
          const ledgerId = await this.recordCharge(
            schoolId,
            student.student_id,
            totalAmount,
            `Fee assessment - ${term} ${academicYear} (${itemNames.join(', ')})`,
            'fee_structure',
            feeStructureId,
            true, // Include student-specific factors ONCE
            tuitionAmount > 0 ? tuitionAmount : null
          );
          results.push({ studentId: student.student_id, ledgerId });
        }
      }

      return results;
    } catch (error) {
      console.error('Fee assessment error:', error);
      throw new Error(`Failed to assess fees: ${error.message}`);
    }
  }
}

export default LedgerService;
