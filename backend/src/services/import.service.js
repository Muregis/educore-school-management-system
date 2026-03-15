import { pool } from "../config/db.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
import { LedgerService } from "./ledger.service.js";
import bcrypt from "bcryptjs";

// Student CSV Import Service
export class ImportService {
  // Parse CSV buffer into array of objects
  static parseCSV(buffer) {
    const content = buffer.toString('utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain headers and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const requiredHeaders = ['admission_number', 'first_name', 'last_name', 'gender'];
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    const students = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) {
        errors.push({ row: i + 1, message: 'Column count mismatch' });
        continue;
      }

      const student = {};
      headers.forEach((header, index) => {
        student[header] = values[index] || null;
      });

      // Validate required fields
      if (!student.admission_number || !student.first_name || !student.last_name || !student.gender) {
        errors.push({ 
          row: i + 1, 
          message: 'Missing required fields: admission_number, first_name, last_name, gender',
          data: student 
        });
        continue;
      }

      // Validate gender
      if (!['male', 'female', 'other'].includes(student.gender.toLowerCase())) {
        errors.push({ 
          row: i + 1, 
          message: 'Gender must be: male, female, or other',
          data: student 
        });
        continue;
      }

      students.push({ ...student, row: i + 1 });
    }

    return { students, errors };
  }

  // Import students from parsed data
  static async importStudents(schoolId, students, req) {
    const connection = await pool.getConnection();
    const results = {
      imported: [],
      duplicates: [],
      errors: []
    };

    try {
      await connection.beginTransaction();

      for (const student of students) {
        try {
          // Check for duplicate admission number
          const [[existing]] = await connection.query(
            `SELECT student_id FROM students 
             WHERE admission_number = ? AND school_id = ? AND is_deleted = 0`,
            [student.admission_number, schoolId]
          );

          if (existing) {
            results.duplicates.push({
              row: student.row,
              admissionNumber: student.admission_number,
              message: 'Admission number already exists'
            });
            continue;
          }

          // Resolve class_id if class_name provided
          let classId = null;
          let className = student.class_name || null;
          
          if (student.class_name) {
            const [[cls]] = await connection.query(
              `SELECT class_id FROM classes WHERE school_id = ? AND class_name = ? LIMIT 1`,
              [schoolId, student.class_name]
            );
            if (cls) {
              classId = cls.class_id;
            } else {
              results.errors.push({
                row: student.row,
                admissionNumber: student.admission_number,
                message: `Class "${student.class_name}" not found`
              });
              continue;
            }
          }

          // Insert student
          const [result] = await connection.query(
            `INSERT INTO students 
             (school_id, class_id, class_name, admission_number, first_name, last_name,
              gender, date_of_birth, phone, email, parent_name, parent_phone, 
              admission_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              schoolId, classId, className, student.admission_number, 
              student.first_name, student.last_name, student.gender.toLowerCase(),
              student.date_of_birth || null, student.phone || null, 
              student.email || null, student.parent_name || null, 
              student.parent_phone || null,
              student.admission_date || new Date().toISOString().slice(0,10), 
              'active'
            ]
          );

          const studentId = result.insertId;

          // Auto-create student portal account
          try {
            const hash = await bcrypt.hash(student.admission_number, 10);
            await connection.query(
              `INSERT IGNORE INTO users 
               (school_id, student_id, full_name, email, password_hash, role, status)
               VALUES (?, ?, ?, ?, ?, 'student', 'active')`,
              [schoolId, studentId, `${student.first_name} ${student.last_name}`, 
               student.admission_number, hash]
            );
          } catch (accountError) {
            // Ignore if account already exists
            console.warn('Student portal account creation failed:', accountError.message);
          }

          // Log successful import
          await logAuditEvent(req, AUDIT_ACTIONS.STUDENT_UPDATE, {
            entityId: studentId,
            entityType: 'student',
            description: `Student imported via CSV: ${student.first_name} ${student.last_name} (${student.admission_number})`,
            newValues: { admissionNumber: student.admission_number, firstName: student.first_name, lastName: student.last_name }
          });

          results.imported.push({
            row: student.row,
            studentId,
            admissionNumber: student.admission_number,
            name: `${student.first_name} ${student.last_name}`
          });

        } catch (error) {
          results.errors.push({
            row: student.row,
            admissionNumber: student.admission_number,
            message: error.message
          });
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

  // Generate CSV template for download
  static generateCSVTemplate() {
    const headers = [
      'admission_number',
      'first_name', 
      'last_name',
      'gender',
      'class_name',
      'date_of_birth',
      'phone',
      'email',
      'parent_name',
      'parent_phone',
      'admission_date'
    ];

    const sampleData = [
      '1001,John,Doe,male,Grade 1A,2015-01-15,0712345678,john@student.com,John Doe,0712345678,2026-01-15',
      '1002,Jane,Smith,female,Grade 1B,2015-03-20,0723456789,jane@student.com,Jane Smith,0723456789,2026-01-15'
    ];

    return headers.join(',') + '\n' + sampleData.join('\n');
  }

  // Export students to CSV
  static async exportStudentsToCSV(schoolId, filters = {}) {
    let whereClause = `WHERE s.school_id = ? AND s.is_deleted = 0`;
    const params = [schoolId];

    if (filters.classId) {
      whereClause += ` AND s.class_id = ?`;
      params.push(filters.classId);
    }

    if (filters.status) {
      whereClause += ` AND s.status = ?`;
      params.push(filters.status);
    }

    const [students] = await pool.query(
      `SELECT s.admission_number, s.first_name, s.last_name, s.gender, 
              s.class_name, s.date_of_birth, s.phone, s.email, 
              s.parent_name, s.parent_phone, s.admission_date, s.status
       FROM students s
       ${whereClause}
       ORDER BY s.class_name, s.admission_number`,
      params
    );

    if (students.length === 0) {
      throw new Error('No students found matching the criteria');
    }

    const headers = [
      'admission_number',
      'first_name',
      'last_name', 
      'gender',
      'class_name',
      'date_of_birth',
      'phone',
      'email',
      'parent_name',
      'parent_phone',
      'admission_date',
      'status'
    ];

    const csvLines = [headers.join(',')];
    
    students.forEach(student => {
      const row = [
        student.admission_number || '',
        `"${student.first_name || ''}"`,
        `"${student.last_name || ''}"`,
        student.gender || '',
        `"${student.class_name || ''}"`,
        student.date_of_birth || '',
        student.phone || '',
        student.email || '',
        `"${student.parent_name || ''}"`,
        student.parent_phone || '',
        student.admission_date || '',
        student.status || ''
      ];
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  // Validate CSV file format
  static validateCSVFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.mimetype.includes('csv') && !file.originalname.endsWith('.csv')) {
      throw new Error('File must be a CSV file');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }

    return true;
  }
}

export default ImportService;
