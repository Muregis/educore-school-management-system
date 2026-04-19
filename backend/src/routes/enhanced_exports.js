/**
 * Enhanced Exports API Routes
 * Handles bulk data export with comprehensive information
 */

import express from 'express';
const router = express.Router();
import { authenticate, authorize } from '../middleware/permissions.js';

// Mock data - replace with actual Supabase calls
const mockStudents = [
  {
    student_id: 1,
    first_name: 'John',
    last_name: 'Doe',
    gender: 'male',
    class_name: 'Grade 5',
    admission_number: 'ADM001',
    parent_name: 'Jane Doe',
    parent_phone: '0712345678',
    date_of_birth: '2010-03-15',
    nemis_number: 'NEM123456',
    blood_group: 'A+',
    allergies: 'None',
    medical_conditions: 'None',
    emergency_contact_name: 'John Doe',
    emergency_contact_phone: '0723456789',
    emergency_contact_relationship: 'Father',
    status: 'active',
    total_fees_paid: 50000,
    total_fees_balance: 10000,
    last_payment_date: '2025-03-15',
    average_score: 85,
    total_subjects: 8,
    attendance_rate: 95,
    last_exam_date: '2025-03-10'
  }
];

const mockGrades = [
  {
    student_id: 1,
    admission_number: 'ADM001',
    subject: 'Mathematics',
    score: 85,
    grade: 'B',
    term: 'Term 1',
    academic_year: '2025',
    exam_date: '2025-03-10',
    teacher: 'Mr. Smith'
  }
];

const mockPayments = [
  {
    student_id: 1,
    admission_number: 'ADM001',
    amount: 10000,
    payment_date: '2025-03-15',
    payment_method: 'M-Pesa',
    transaction_id: 'ABC123',
    term: 'Term 1',
    academic_year: '2025',
    fee_type: 'Tuition'
  }
];

/**
 * GET /api/students/export
 * Export students with comprehensive data including performance and fee history
 */
router.get('/students/export', authenticate, authorize('bulk-import'), async (req, res) => {
  try {
    const { 
      filter = 'all', 
      class: className, 
      defaulterAmount = 0,
      studentIds 
    } = req.query;
    
    let students = [...mockStudents];
    
    // Apply filters
    if (filter === 'class' && className && className !== 'all') {
      students = students.filter(student => student.class_name === className);
    }
    
    if (filter === 'defaulter') {
      students = students.filter(student => student.total_fees_balance >= defaulterAmount);
    }
    
    if (filter === 'individual' && studentIds) {
      const ids = studentIds.split(',');
      students = students.filter(student => ids.includes(student.student_id.toString()));
    }
    
    // Generate CSV
    const csvHeaders = [
      'first_name', 'last_name', 'gender', 'class_name', 'admission_number',
      'parent_name', 'parent_phone', 'date_of_birth', 'nemis_number', 'blood_group',
      'allergies', 'medical_conditions', 'emergency_contact_name', 
      'emergency_contact_phone', 'emergency_contact_relationship', 'status',
      'total_fees_paid', 'total_fees_balance', 'last_payment_date',
      'average_score', 'total_subjects', 'attendance_rate', 'last_exam_date'
    ];
    
    const csvRows = students.map(student => 
      csvHeaders.map(header => student[header] || '').join(',')
    );
    
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_export.csv');
    res.send(csvContent);
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to export students', error: error.message });
  }
});

/**
 * GET /api/grades/export
 * Export grades data with performance history
 */
router.get('/grades/export', authenticate, authorize('bulk-import'), async (req, res) => {
  try {
    const csvHeaders = ['student_id', 'admission_number', 'subject', 'score', 'grade', 'term', 'academic_year', 'exam_date', 'teacher'];
    const csvRows = mockGrades.map(grade => 
      csvHeaders.map(header => grade[header] || '').join(',')
    );
    
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=grades_export.csv');
    res.send(csvContent);
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to export grades', error: error.message });
  }
});

/**
 * GET /api/payments/export
 * Export payments data with fee history
 */
router.get('/payments/export', authenticate, authorize('bulk-import'), async (req, res) => {
  try {
    const csvHeaders = ['student_id', 'admission_number', 'amount', 'payment_date', 'payment_method', 'transaction_id', 'term', 'academic_year', 'fee_type'];
    const csvRows = mockPayments.map(payment => 
      csvHeaders.map(header => payment[header] || '').join(',')
    );
    
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments_export.csv');
    res.send(csvContent);
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to export payments', error: error.message });
  }
});

export default router;
