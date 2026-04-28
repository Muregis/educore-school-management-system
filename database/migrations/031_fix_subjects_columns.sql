-- Quick fix for subjects table columns
-- Run this in Supabase SQL Editor if subjects aren't saving

-- 1. Ensure both columns exist
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS name VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS subject_name VARCHAR(100) NULL;

-- 2. Make subject_name NOT NULL if it has data, otherwise allow NULL for now
DO $$
BEGIN
  -- Check if subject_name has any NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' 
    AND column_name = 'subject_name' 
    AND is_nullable = 'YES'
  ) THEN
    -- Update any null subject_name from name
    UPDATE subjects SET subject_name = name WHERE subject_name IS NULL AND name IS NOT NULL;
    
    -- If there are still nulls, set a default
    UPDATE subjects SET subject_name = 'Unnamed Subject' WHERE subject_name IS NULL;
  END IF;
END $$;

-- 3. Sync the columns both ways
UPDATE subjects SET name = subject_name WHERE name IS NULL AND subject_name IS NOT NULL;
UPDATE subjects SET subject_name = name WHERE subject_name IS NULL AND name IS NOT NULL;

-- 4. Drop any conflicting unique constraints and recreate
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_id_name_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_id_subject_name_key;

-- 5. Add unique constraint on subject_name (the primary column)
ALTER TABLE subjects ADD CONSTRAINT subjects_school_id_subject_name_key 
  UNIQUE (school_id, subject_name);

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_subjects_school_subject_name ON subjects(school_id, subject_name);
CREATE INDEX IF NOT EXISTS idx_subjects_school_name ON subjects(school_id, name);

SELECT 'Subjects columns fixed successfully' AS status;
