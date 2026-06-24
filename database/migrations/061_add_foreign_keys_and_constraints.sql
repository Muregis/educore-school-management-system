-- Phase 2: Database Modernization
-- Migration: Add foreign keys and constraints
-- Purpose: Enforce referential integrity and data consistency
-- Backward Compatible: Yes - adds constraints without breaking existing data

BEGIN;

-- Add foreign key constraints to students table
DO $$
BEGIN
    -- Class foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='class_id') THEN
        ALTER TABLE students 
        DROP CONSTRAINT IF EXISTS fk_students_class,
        ADD CONSTRAINT fk_students_class 
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
    END IF;
    
    -- Stream foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='stream_id') THEN
        ALTER TABLE students 
        DROP CONSTRAINT IF EXISTS fk_students_stream,
        ADD CONSTRAINT fk_students_stream 
        FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL;
    END IF;
    
    -- Guardian foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_id') THEN
        ALTER TABLE students 
        DROP CONSTRAINT IF EXISTS fk_students_guardian,
        ADD CONSTRAINT fk_students_guardian 
        FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraints to teachers table
DO $$
BEGIN
    -- Department foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='department_id') THEN
        ALTER TABLE teachers 
        DROP CONSTRAINT IF EXISTS fk_teachers_department,
        ADD CONSTRAINT fk_teachers_department 
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraints to exam_results table
DO $$
BEGIN
    -- Student foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='student_id') THEN
        ALTER TABLE exam_results 
        DROP CONSTRAINT IF EXISTS fk_exam_results_student,
        ADD CONSTRAINT fk_exam_results_student 
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
    
    -- Subject foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='subject_id') THEN
        ALTER TABLE exam_results 
        DROP CONSTRAINT IF EXISTS fk_exam_results_subject,
        ADD CONSTRAINT fk_exam_results_subject 
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;
    END IF;
    
    -- Exam foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='exam_id') THEN
        ALTER TABLE exam_results 
        DROP CONSTRAINT IF EXISTS fk_exam_results_exam,
        ADD CONSTRAINT fk_exam_results_exam 
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Add foreign key constraints to payments table
DO $$
BEGIN
    -- Student foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='student_id') THEN
        ALTER TABLE payments 
        DROP CONSTRAINT IF EXISTS fk_payments_student,
        ADD CONSTRAINT fk_payments_student 
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
    END IF;
    
    -- Invoice foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='invoice_id') THEN
        ALTER TABLE payments 
        DROP CONSTRAINT IF EXISTS fk_payments_invoice,
        ADD CONSTRAINT fk_payments_invoice 
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraints to invoices table
DO $$
BEGIN
    -- Student foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='student_id') THEN
        ALTER TABLE invoices 
        DROP CONSTRAINT IF EXISTS fk_invoices_student,
        ADD CONSTRAINT fk_invoices_student 
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Add foreign key constraints to attendance table
DO $$
BEGIN
    -- Student foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='student_id') THEN
        ALTER TABLE attendance 
        DROP CONSTRAINT IF EXISTS fk_attendance_student,
        ADD CONSTRAINT fk_attendance_student 
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
    
    -- Class foreign key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='class_id') THEN
        ALTER TABLE attendance 
        DROP CONSTRAINT IF EXISTS fk_attendance_class,
        ADD CONSTRAINT fk_attendance_class 
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Add unique constraints
DO $$
BEGIN
    -- Unique admission number per school
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='admission_number') THEN
        ALTER TABLE students 
        DROP CONSTRAINT IF EXISTS uk_students_admission_school,
        ADD CONSTRAINT uk_students_admission_school 
        UNIQUE (admission_number, school_id);
    END IF;
    
    -- Unique email per school
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='email') THEN
        ALTER TABLE students 
        DROP CONSTRAINT IF EXISTS uk_students_email_school,
        ADD CONSTRAINT uk_students_email_school 
        UNIQUE (email, school_id);
    END IF;
    
    -- Unique staff number per school
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='staff_number') THEN
        ALTER TABLE teachers 
        DROP CONSTRAINT IF EXISTS uk_teachers_staff_school,
        ADD CONSTRAINT uk_teachers_staff_school 
        UNIQUE (staff_number, school_id);
    END IF;
END $$;

-- Add check constraints
DO $$
BEGIN
    -- Ensure marks are between 0 and 100
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='marks') THEN
        ALTER TABLE exam_results 
        DROP CONSTRAINT IF EXISTS chk_exam_results_marks_range,
        ADD CONSTRAINT chk_exam_results_marks_range 
        CHECK (marks >= 0 AND marks <= 100);
    END IF;
    
    -- Ensure payment amount is positive
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='amount') THEN
        ALTER TABLE payments 
        DROP CONSTRAINT IF EXISTS chk_payments_amount_positive,
        ADD CONSTRAINT chk_payments_amount_positive 
        CHECK (amount > 0);
    END IF;
    
    -- Ensure invoice total is positive
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='total') THEN
        ALTER TABLE invoices 
        DROP CONSTRAINT IF EXISTS chk_invoices_total_positive,
        ADD CONSTRAINT chk_invoices_total_positive 
        CHECK (total >= 0);
    END IF;
END $$;

COMMIT;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, class_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_school_admission ON students(school_id, admission_number);
CREATE INDEX IF NOT EXISTS idx_teachers_school_department ON teachers(school_id, department_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exam_results_student_subject ON exam_results(student_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_student ON exam_results(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_date ON payments(student_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_invoices_student_status ON invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, attendance_date);
