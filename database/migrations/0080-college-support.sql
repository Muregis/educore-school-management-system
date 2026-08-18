-- Migration 0080: Add institution_type to schools table
-- PostgreSQL-compatible migration to distinguish school vs college tenants
-- Uses VARCHAR + CHECK constraint (no ENUM types)

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS institution_type VARCHAR(20) NOT NULL DEFAULT 'school';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_institution_type_check'
  ) THEN
    ALTER TABLE schools
    ADD CONSTRAINT schools_institution_type_check
    CHECK (institution_type IN ('school', 'college'));
  END IF;
END $$;

-- Verify existing schools remain as 'school'
UPDATE schools SET institution_type = 'school' WHERE institution_type IS NULL;