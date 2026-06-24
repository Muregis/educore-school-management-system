-- Create composite indexes
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_students_school_admission ON students(school_id, admission_number);
CREATE INDEX IF NOT EXISTS idx_teachers_school_department ON teachers(school_id, department_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student_subject ON exam_results(student_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_student ON exam_results(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_date ON payments(student_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_invoices_student_status ON invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, attendance_date);
