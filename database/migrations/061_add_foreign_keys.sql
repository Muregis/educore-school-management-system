-- Add foreign key constraints
BEGIN;

-- Students table foreign keys
ALTER TABLE students 
DROP CONSTRAINT IF EXISTS fk_students_class,
ADD CONSTRAINT fk_students_class 
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

ALTER TABLE students 
DROP CONSTRAINT IF EXISTS fk_students_stream,
ADD CONSTRAINT fk_students_stream 
FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL;

-- Exam results foreign keys
ALTER TABLE exam_results 
DROP CONSTRAINT IF EXISTS fk_exam_results_student,
ADD CONSTRAINT fk_exam_results_student 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE exam_results 
DROP CONSTRAINT IF EXISTS fk_exam_results_subject,
ADD CONSTRAINT fk_exam_results_subject 
FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;

-- Payments foreign keys
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS fk_payments_student,
ADD CONSTRAINT fk_payments_student 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

COMMIT;
