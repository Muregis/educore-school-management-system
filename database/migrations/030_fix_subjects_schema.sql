-- Migration: Fix subjects table schema and seed default CBC subjects
-- Issue 3: Subjects not saving / auto-creating when grades are entered

-- Ensure subjects table exists with correct columns (use subject_name as primary)
CREATE TABLE IF NOT EXISTS subjects (
  subject_id      BIGSERIAL PRIMARY KEY,
  school_id       BIGINT NOT NULL REFERENCES schools(school_id),
  subject_name    VARCHAR(100) NOT NULL,  -- Primary column for subject name
  name            VARCHAR(100) NULL,      -- Alias column for compatibility
  code            VARCHAR(20) NULL,
  category        VARCHAR(50) NULL,
  description     TEXT NULL,
  class_levels    VARCHAR(255) NULL,
  max_marks       INTEGER NOT NULL DEFAULT 100,
  pass_marks      INTEGER NOT NULL DEFAULT 40,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, subject_name)
);

-- Add name column if missing (for backward compatibility with code that uses 'name')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'name'
  ) THEN
    ALTER TABLE subjects ADD COLUMN name VARCHAR(100) NULL;
  END IF;
END $$;

-- Sync name with subject_name for existing records (so both columns have data)
UPDATE subjects 
SET name = subject_name 
WHERE name IS NULL AND subject_name IS NOT NULL;

-- Also sync the other direction (in case some records have name but not subject_name)
UPDATE subjects 
SET subject_name = name 
WHERE subject_name IS NULL AND name IS NOT NULL;

-- Drop and recreate unique constraint to ensure it uses subject_name
DO $$
BEGIN
  -- Try to drop existing constraint on 'name' if it exists
  ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_id_name_key;
  
  -- Add unique constraint on subject_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'subjects' AND indexname LIKE '%subject_name%'
  ) THEN
    ALTER TABLE subjects ADD CONSTRAINT subjects_school_id_subject_name_key 
      UNIQUE (school_id, subject_name);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id, is_deleted, is_active);
CREATE INDEX IF NOT EXISTS idx_subjects_subject_name ON subjects(school_id, subject_name);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(school_id, name);

-- Function to auto-seed default CBC subjects for a new school
CREATE OR REPLACE FUNCTION seed_default_subjects_for_school(p_school_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_subject RECORD;
BEGIN
  -- Default Kenyan CBC subjects
  FOR v_subject IN SELECT * FROM (VALUES
    ('Mathematics', 'MAT', 'Sciences'),
    ('English', 'ENG', 'Languages'),
    ('Kiswahili', 'KIS', 'Languages'),
    ('Science & Technology', 'SCI', 'Sciences'),
    ('Social Studies', 'SST', 'Humanities'),
    ('Religious Education', 'RE', 'Humanities'),
    ('Christian Religious Education', 'CRE', 'Humanities'),
    ('Islamic Religious Education', 'IRE', 'Humanities'),
    ('Hindu Religious Education', 'HRE', 'Humanities'),
    ('Creative Arts', 'ART', 'Creative'),
    ('Physical Education', 'PE', 'Creative'),
    ('Home Science', 'HS', 'Technical'),
    ('Agriculture', 'AGR', 'Technical'),
    ('Computer Studies', 'COMP', 'Technical'),
    ('Business Studies', 'BST', 'Technical'),
    ('Biology', 'BIO', 'Sciences'),
    ('Chemistry', 'CHEM', 'Sciences'),
    ('Physics', 'PHY', 'Sciences'),
    ('History', 'HIST', 'Humanities'),
    ('Geography', 'GEO', 'Humanities')
  ) AS t(name, code, category)
  LOOP
    -- Insert only if not exists (using unique constraint on school_id, subject_name)
    INSERT INTO subjects (school_id, subject_name, name, code, category, is_active)
    VALUES (p_school_id, v_subject.name, v_subject.name, v_subject.code, v_subject.category, TRUE)
    ON CONFLICT (school_id, subject_name) DO NOTHING;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Seed subjects for any schools that have none
DO $$
DECLARE
  v_school RECORD;
  v_has_subjects BOOLEAN;
BEGIN
  FOR v_school IN SELECT school_id FROM schools WHERE is_deleted = FALSE
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM subjects 
      WHERE school_id = v_school.school_id AND is_deleted = FALSE
    ) INTO v_has_subjects;
    
    IF NOT v_has_subjects THEN
      PERFORM seed_default_subjects_for_school(v_school.school_id);
    END IF;
  END LOOP;
END $$;

SELECT 'Subjects table schema fixed and default subjects seeded' AS status;
