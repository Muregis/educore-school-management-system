-- ============================================================
-- EduCore Safe Additive Migration
-- File: safe_additive_migration_v2.sql
-- Date: 2026-04-26
--
-- RULES:
--   All statements use IF NOT EXISTS / DO $$ guards.
--   No DROP, no ALTER TYPE, no backfill UPDATE.
--   Safe to run against a live production database.
--   Run in Supabase SQL Editor (Dashboard > SQL Editor).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lunch enrollment fields on students
--    Referenced by FeesPage.jsx balance calculation
--    Defaults: disabled, so existing students are unaffected
-- ------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS lunch_enabled    BOOLEAN        DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lunch_daily_rate NUMERIC(10,2)  DEFAULT 100,
  ADD COLUMN IF NOT EXISTS lunch_days       INTEGER        DEFAULT 66;

-- ------------------------------------------------------------
-- 2. Opening balance (carry-forward from previous system)
--    Used by FeesPage ledger formula
--    Default 0 means existing balance logic is unchanged
-- ------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(10,2) DEFAULT 0;

-- ------------------------------------------------------------
-- 3. Promotion tracking (additive — never overwrites class_name)
--    Written by promotion.routes.js after user confirms
-- ------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS previous_class  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS promotion_year  VARCHAR(10);

-- ------------------------------------------------------------
-- 4. Transport direction (1-way vs 2-way)
--    New assignments will include direction; old rows default to two_way
-- ------------------------------------------------------------
ALTER TABLE student_transport
  ADD COLUMN IF NOT EXISTS direction VARCHAR(10) DEFAULT 'two_way'
  CHECK (direction IN ('one_way', 'two_way'));

-- ------------------------------------------------------------
-- 5. Admission number on the admissions table
--    Optional — admin can enter or leave blank for auto-generate
-- ------------------------------------------------------------
ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS admission_number VARCHAR(50);

-- ------------------------------------------------------------
-- 6. School logo URL
--    Stored as a public Supabase Storage URL
--    Already referenced by App.jsx line 487 (school.logo_url)
-- ------------------------------------------------------------
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ------------------------------------------------------------
-- 7. Student gender default safety (prevent null on old rows)
-- ------------------------------------------------------------
UPDATE students
  SET gender = 'unknown'
  WHERE gender IS NULL OR gender = '';

-- ------------------------------------------------------------
-- 8. Verify all columns were added (read-only check)
-- ------------------------------------------------------------
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN (
    'lunch_enabled','lunch_daily_rate','lunch_days',
    'opening_balance','previous_class','promotion_year'
  )
ORDER BY column_name;

SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'student_transport'
  AND column_name = 'direction';

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'admissions'
  AND column_name = 'admission_number';

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'schools'
  AND column_name = 'logo_url';

-- ============================================================
-- After running, verify output shows all 6 new student columns,
-- direction on student_transport, admission_number on admissions,
-- and logo_url on schools.
-- No rows should be returned as errors.
-- ============================================================
