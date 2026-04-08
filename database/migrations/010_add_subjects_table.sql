-- Migration: Add subjects table for school curriculum management
-- Schools can define their own subjects per class or globally

CREATE TABLE IF NOT EXISTS subjects (
  subject_id      BIGSERIAL PRIMARY KEY,
  school_id       BIGINT NOT NULL REFERENCES schools(school_id),
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(20) NULL,
  category        VARCHAR(50) NULL, -- e.g., Sciences, Languages, Humanities
  description     TEXT NULL,
  -- Optional: subject can be assigned to specific classes
  class_levels    VARCHAR(255) NULL, -- e.g., 'Grade 1,Grade 2,Grade 3' or NULL for all
  -- Grading configuration
  max_marks       INTEGER NOT NULL DEFAULT 100,
  pass_marks      INTEGER NOT NULL DEFAULT 40,
  -- Subject status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Ensure subject names are unique per school
  UNIQUE (school_id, name)
);

-- Index for school lookups
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id, is_deleted, is_active);
CREATE INDEX IF NOT EXISTS idx_subjects_category ON subjects(category);

-- Add comment for documentation
COMMENT ON TABLE subjects IS 'School curriculum subjects. Schools can define their own subjects with custom grading scales.';
COMMENT ON COLUMN subjects.class_levels IS 'Comma-separated list of class names this subject applies to, or NULL for all classes';

-- Insert default Kenyan curriculum subjects (optional, can be customized per school)
-- These will be added when a school is created via trigger or manually by admin

SELECT 'Subjects table created successfully' AS status;
