import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { LedgerService } from "../services/ledger.service.js";

const router = Router();
router.use(authRequired);

// ─── GET /api/ledger/student/:studentId ───────────────────────────────────────
router.get("/student/:studentId", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify student belongs to school
    const [[student]] = await pool.query(
      `SELECT student_id, first_name, last_name FROM students 
       WHERE student_id = ? AND school_id = ? AND is_deleted = 0`,
      [studentId, schoolId]
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const ledger = await LedgerService.getStudentLedger(schoolId, studentId, parseInt(limit), parseInt(offset));
    const balance = await LedgerService.getStudentBalance(schoolId, studentId);

    res.json({
      student: {
        studentId: student.student_id,
        name: `${student.first_name} ${student.last_name}`
      },
      balance,
      transactions: ledger
    });

  } catch (error) {
    next(error);
  }
});

// ─── GET /api/ledger/student/:studentId/statement ───────────────────────────────
router.get("/student/:studentId/statement", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const { term } = req.query;

    // Verify student belongs to school
    const [[student]] = await pool.query(
      `SELECT student_id, first_name, last_name FROM students 
       WHERE student_id = ? AND school_id = ? AND is_deleted = 0`,
      [studentId, schoolId]
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const statement = await LedgerService.getFeeStatement(schoolId, studentId, term);

    res.json(statement);

  } catch (error) {
    next(error);
  }
});

// ─── POST /api/ledger/assess-fees ─────────────────────────────────────────────
router.post("/assess-fees", 
  requireRoles("admin", "finance"), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { classId, feeStructureId, term, academicYear } = req.body;

      if (!classId || !feeStructureId || !term || !academicYear) {
        return res.status(400).json({ 
          message: "classId, feeStructureId, term, and academicYear are required" 
        });
      }

      // Verify class belongs to school
      const [[cls]] = await pool.query(
        `SELECT class_id, class_name FROM classes 
         WHERE class_id = ? AND school_id = ? AND is_deleted = 0`,
        [classId, schoolId]
      );

      if (!cls) {
        return res.status(404).json({ message: "Class not found" });
      }

      const results = await LedgerService.assessFeesForClass(
        schoolId, classId, feeStructureId, term, academicYear
      );

      res.json({
        message: "Fees assessed successfully",
        className: cls.class_name,
        term,
        academicYear,
        assessments: results.length
      });

    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/ledger/balances ─────────────────────────────────────────────────
router.get("/balances", 
  requireRoles("admin", "finance", "teacher"), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { classId, status } = req.query;

      let whereClause = `WHERE s.school_id = ? AND s.is_deleted = 0`;
      const params = [schoolId];

      if (classId) {
        whereClause += ` AND s.class_id = ?`;
        params.push(classId);
      }

      // Get students with their latest balance
      const [students] = await pool.query(
        `SELECT s.student_id, s.admission_number, s.first_name, s.last_name, s.class_name,
                COALESCE(sl.balance_after, 0) as balance,
                sl.created_at as last_transaction_date
         FROM students s
         LEFT JOIN (
           SELECT student_id, balance_after, created_at,
                  ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY ledger_id DESC) as rn
           FROM student_ledger
           WHERE school_id = ?
         ) sl ON sl.student_id = s.student_id AND sl.rn = 1
         ${whereClause}
         ORDER BY s.class_name, s.first_name`,
        [schoolId, ...params.slice(1)]
      );

      // Filter by balance status if requested
      let filteredStudents = students;
      if (status === 'owing') {
        filteredStudents = students.filter(s => s.balance > 0);
      } else if (status === 'paid') {
        filteredStudents = students.filter(s => s.balance <= 0);
      }

      // Calculate summary
      const summary = {
        totalStudents: filteredStudents.length,
        totalOwing: filteredStudents.filter(s => s.balance > 0).length,
        totalPaid: filteredStudents.filter(s => s.balance <= 0).length,
        totalBalance: filteredStudents.reduce((sum, s) => sum + Number(s.balance), 0)
      };

      res.json({
        summary,
        students: filteredStudents
      });

    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/ledger/adjustment ───────────────────────────────────────────────
router.post("/adjustment", 
  requireRoles("admin", "finance"), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { studentId, amount, description, adjustmentType = 'manual' } = req.body;

      if (!studentId || !amount || !description) {
        return res.status(400).json({ 
          message: "studentId, amount, and description are required" 
        });
      }

      // Verify student belongs to school
      const [[student]] = await pool.query(
        `SELECT student_id, first_name, last_name FROM students 
         WHERE student_id = ? AND school_id = ? AND is_deleted = 0`,
        [studentId, schoolId]
      );

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

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

        // Insert adjustment entry
        const [result] = await connection.query(
          `INSERT INTO student_ledger 
           (school_id, student_id, transaction_type, amount, balance_after, 
            reference_type, reference_id, description)
           VALUES (?, ?, 'adjustment', ?, ?, 'adjustment', NULL, ?)`,
          [schoolId, studentId, amount, newBalance, description]
        );

        // Log adjustment for audit
        await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_UPDATE, {
          entityId: result.insertId,
          entityType: 'ledger_adjustment',
          description: `Ledger adjustment for student ${studentId}: ${amount} (${description})`,
          newValues: { studentId, amount, previousBalance, newBalance, description }
        });

        await connection.commit();

        res.json({
          message: "Adjustment recorded successfully",
          adjustmentId: result.insertId,
          previousBalance,
          newBalance,
          amount
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      next(error);
    }
  }
);

export default router;
