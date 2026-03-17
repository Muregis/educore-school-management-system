// OLD: MySQL-specific Ledger Service (commented for safety)
// This file used MySQL-specific syntax and is replaced by ledger.service.js which uses Supabase
/*
import { pool } from "../config/db.js";
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
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get current balance
      const [[currentBalance]] = await connection.query(
        `SELECT balance_after FROM student_ledger 
         WHERE student_id = ? AND school_id = ? 
         ORDER BY ledger_id DESC LIMIT 1`,
        [studentId, schoolId]
      );

      const previousBalance = currentBalance?.balance_after || 0;
      const newBalance = previousBalance + Number(amount);

      // Insert ledger entry
      const [result] = await connection.query(
        `INSERT INTO student_ledger 
         (school_id, student_id, transaction_type, amount, balance_after, 
          reference_type, reference_id, description, receipt_number)
         VALUES (?, ?, 'charge', ?, ?, ?, ?, ?, NULL)`,
        [schoolId, studentId, amount, newBalance, referenceType, referenceId, description]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Record a payment in student ledger
  static async recordPayment(schoolId, studentId, amount, description, paymentId, req) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get current balance
      const [[currentBalance]] = await connection.query(
        `SELECT balance_after FROM student_ledger 
         WHERE student_id = ? AND school_id = ? 
         ORDER BY ledger_id DESC LIMIT 1`,
        [studentId, schoolId]
      );

      const previousBalance = currentBalance?.balance_after || 0;
      const newBalance = previousBalance - Number(amount);
      const receiptNumber = this.generateReceiptNumber();

      // Insert ledger entry
      const [result] = await connection.query(
        `INSERT INTO student_ledger 
         (school_id, student_id, transaction_type, amount, balance_after, 
          reference_type, reference_id, description, receipt_number)
         VALUES (?, ?, 'payment', ?, ?, 'payment', ?, ?, ?)`,
        [schoolId, studentId, amount, newBalance, paymentId, description, receiptNumber]
      );

      // Log payment creation for audit
      if (req) {
        await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_CREATE, {
          entityId: paymentId,
          entityType: 'payment',
          description: `Payment recorded: KES ${amount} for student ${studentId} - Receipt: ${receiptNumber}`,
          newValues: { studentId, amount, receiptNumber, balanceAfter: newBalance }
        });
      }

      await connection.commit();
      return { ledgerId: result.insertId, receiptNumber, newBalance };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get student balance
  static async getStudentBalance(schoolId, studentId) {
    const [[result]] = await pool.query(
      `SELECT balance_after FROM student_ledger 
       WHERE student_id = ? AND school_id = ? 
       ORDER BY ledger_id DESC LIMIT 1`,
      [studentId, schoolId]
    );
    return result?.balance_after || 0;
  }

  // Get student ledger entries
  static async getStudentLedger(schoolId, studentId, limit = 50, offset = 0) {
    const [rows] = await pool.query(
      `SELECT * FROM student_ledger 
       WHERE school_id = ? AND student_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [schoolId, studentId, limit, offset]
    );
    return rows;
  }

  // Get fee statement for student
  static async getFeeStatement(schoolId, studentId, term = null) {
    let whereClause = `WHERE sl.school_id = ? AND sl.student_id = ?`;
    const params = [schoolId, studentId];
    
    if (term) {
      whereClause += ` AND sl.term = ?`;
      params.push(term);
    }

    const [rows] = await pool.query(
      `SELECT sl.*, s.first_name, s.last_name, s.admission_number
       FROM student_ledger sl
       JOIN students s ON s.student_id = sl.student_id
       ${whereClause}
       ORDER BY sl.created_at DESC`,
      params
    );

    // Calculate summary
    const [[summary]] = await pool.query(
      `SELECT 
         SUM(CASE WHEN transaction_type = 'charge' THEN amount ELSE 0 END) as total_charges,
         SUM(CASE WHEN transaction_type = 'payment' THEN amount ELSE 0 END) as total_payments,
         COALESCE(MAX(CASE WHEN transaction_type = 'payment' THEN balance_after END), 
                  (SELECT balance_after FROM student_ledger WHERE student_id = ? AND school_id = ? ORDER BY ledger_id DESC LIMIT 1)) as current_balance
       FROM student_ledger 
       WHERE school_id = ? AND student_id = ?`,
      [studentId, schoolId, schoolId, studentId]
    );

    return {
      student: rows[0] ? {
        studentId: rows[0].student_id,
        firstName: rows[0].first_name,
        lastName: rows[0].last_name,
        admissionNumber: rows[0].admission_number
      } : null,
      transactions: rows,
      summary: {
        totalCharges: Number(summary.total_charges) || 0,
        totalPayments: Number(summary.total_payments) || 0,
        currentBalance: Number(summary.current_balance) || 0
      }
    };
  }

  // Create fee assessment for multiple students
  static async assessFeesForClass(schoolId, classId, feeStructureId, term, academicYear) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get students in class
      const [students] = await connection.query(
        `SELECT student_id FROM students WHERE class_id = ? AND school_id = ? AND is_deleted = 0`,
        [classId, schoolId]
      );

      // Get fee structure
      const [[feeStructure]] = await connection.query(
        `SELECT * FROM fee_structures WHERE fee_structure_id = ? AND school_id = ? AND is_deleted = 0`,
        [feeStructureId, schoolId]
      );

      if (!feeStructure) {
        throw new Error('Fee structure not found');
      }

      // Get fee items for this structure
      const [feeItems] = await connection.query(
        `SELECT * FROM fee_items WHERE fee_structure_id = ? AND school_id = ?`,
        [feeStructureId, schoolId]
      );

      // Assess fees for each student
      const results = [];
      for (const student of students) {
        for (const feeItem of feeItems) {
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

      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default LedgerService;
*/
