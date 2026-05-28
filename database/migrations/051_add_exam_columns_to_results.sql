-- =====================================================
-- Add exam-related columns to results table
-- This allows multiple exams per term (Opener, Mid-Term, End-Term)
-- =====================================================

-- Add exam_type column
ALTER TABLE results
ADD COLUMN IF NOT EXISTS exam_type VARCHAR(50) DEFAULT 'Mid-Term';

-- Add exam_sequence column for ordering
ALTER TABLE results
ADD COLUMN IF NOT EXISTS exam_sequence INTEGER DEFAULT 2;

-- Add exam_name column for display
ALTER TABLE results
ADD COLUMN IF NOT EXISTS exam_name VARCHAR(100);

-- Add academic_year column
ALTER TABLE results
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10);

-- Create index for exam_type lookups
CREATE INDEX IF NOT EXISTS idx_results_exam_type
ON results(school_id, exam_type, term)
WHERE is_deleted = false;

-- Create index for student+exam lookups
CREATE INDEX IF NOT EXISTS idx_results_student_exam
ON results(student_id, exam_type, term)
WHERE is_deleted = false;

-- Add comments
COMMENT ON COLUMN results.exam_type IS 'Type of exam (e.g., Opener, Mid-Term, End-Term)';
COMMENT ON COLUMN results.exam_sequence IS 'Sequence number for ordering (1=Opener, 2=Mid-Term, 3=End-Term)';
COMMENT ON COLUMN results.exam_name IS 'Display name for the exam';
COMMENT ON COLUMN results.academic_year IS 'Academic year (e.g., 2024)';

-- Update unique constraint to include exam_type
-- This allows multiple results per subject per term if they have different exam types
-- First, drop the old constraint if it exists
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_school_id_student_id_subject_term_key;

-- Add new unique constraint including exam_type
ALTER TABLE results
ADD CONSTRAINT results_school_id_student_id_subject_term_exam_type_key
UNIQUE(school_id, student_id, subject, term, exam_type);
