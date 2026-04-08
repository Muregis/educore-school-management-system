-- Migration: Add NEMIS number to students table
-- Kenyan curriculum requirement

-- Add nemis_number column to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS nemis_number VARCHAR(40) NULL;

-- Add comment for documentation
COMMENT ON COLUMN students.nemis_number IS 'NEMIS (National Education Management Information System) number for Kenyan curriculum';

-- Add index for quick NEMIS lookups
CREATE INDEX IF NOT EXISTS idx_students_nemis ON students(school_id, nemis_number);

SELECT 'NEMIS number column added to students table successfully' AS status;
