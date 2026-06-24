-- Repair orphan records
BEGIN;

-- Students with invalid class_id
UPDATE students 
SET class_id = NULL 
WHERE class_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM classes WHERE id = students.class_id);

-- Students with invalid stream_id
UPDATE students 
SET stream_id = NULL 
WHERE stream_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM streams WHERE id = students.stream_id);

-- Exam results with invalid student_id
DELETE FROM exam_results 
WHERE student_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM students WHERE id = exam_results.student_id);

-- Exam results with invalid subject_id
UPDATE exam_results 
SET subject_id = NULL 
WHERE subject_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM subjects WHERE id = exam_results.subject_id);

-- Payments with invalid student_id
DELETE FROM payments 
WHERE student_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM students WHERE id = payments.student_id);

COMMIT;
