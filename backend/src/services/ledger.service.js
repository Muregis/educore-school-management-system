import { database } from "../config/db.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";

// Student Ledger Service for fee balance tracking
export class LedgerService {
  // Generate receipt number
  static generateReceiptNumber() {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `REC-${date}-${random}`;
  }

  // Record a charge (fee assessment) in student ledger
  static async recordCharge(schoolId, studentId, amount, description, referenceType = null, referenceId = null) {
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
      const newBalance = previousBalance + Number(amount);

      // Insert ledger entry using Supabase
      const { data: result } = await database.insert('student_ledger', {
        school_id: schoolId,
        student_id: studentId,
        transaction_type: 'charge',
        amount: Number(amount),
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
      // Get current balance using Supabase
      const { data: currentEntries } = await database.query('student_ledger', {
        select: 'balance_after',
        where: { student_id: studentId },
        schoolId: schoolId,
        order: { column: 'ledger_id', ascending: false },
        limit: 1
      });

      const previousBalance = currentEntries?.[0]?.balance_after || 0;
      const newBalance = previousBalance - Number(amount);
      const receiptNumber = this.generateReceiptNumber();

      // Insert ledger entry using Supabase
      const { data: result } = await database.insert('student_ledger', {
        school_id: schoolId,
        student_id: studentId,
        transaction_type: 'payment',
        amount: Number(amount),
        balance_after: newBalance,
        reference_type: 'payment',
        reference_id: paymentId,
        description: description,
        receipt_number: receiptNumber
      });

      // Log payment creation for audit
      if (req) {
        await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_CREATE, {
          entityId: paymentId,
          entityType: 'payment',
          description: `Payment recorded: KES ${amount} for student ${studentId} - Receipt: ${receiptNumber}`,
          newValues: { studentId, amount, receiptNumber, balanceAfter: newBalance }
        });
      }

      return { ledgerId: result[0]?.ledger_id, receiptNumber, newBalance };
    } catch (error) {
      console.error('Ledger payment error:', error);
      throw new Error(`Failed to record payment: ${error.message}`);
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
        for (const feeItem of feeItems || []) {
          if (!feeItem.is_optional) {
            const ledgerId = await this.recordCharge(
              schoolId, 
              student.student_id, 
              feeItem.amount, 
              `${feeItem.item_name} - ${term} ${academicYear}`,
              'fee_item',
              feeItem.fee_item_id
            );
            results.push({ studentId: student.student_id, feeItemId: feeItem.fee_item_id, ledgerId });
          }
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
