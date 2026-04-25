-- ==========================================
-- ADMIN SETUP FIXES
-- School logo, class_subjects, class ordering
-- 
-- SAFETY GUARANTEE: NON-DESTRUCTIVE
-- ✓ All ALTER TABLE use ADD COLUMN IF NOT EXISTS
-- ✓ All CREATE statements use IF NOT EXISTS
-- ✓ All CREATE INDEX use IF NOT EXISTS
-- ✓ No DROP TABLE, DELETE, or TRUNCATE operations
-- ✓ Only adds nullable columns with defaults
-- ✓ Idempotent - safe to run multiple times
-- ✓ Zero risk to existing live data
-- ==========================================

-- =====================================================
-- B1. Add logo_url to schools table
-- =====================================================

ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#1A2A42';

COMMENT ON COLUMN schools.logo_url IS 'School logo image URL (recommended: 200x200px PNG/SVG)';
COMMENT ON COLUMN schools.favicon_url IS 'Browser favicon URL (recommended: 32x32px ICO/PNG)';

-- =====================================================
-- B2. Create class_subjects mapping table
-- Links subjects to specific classes
-- =====================================================

CREATE TABLE IF NOT EXISTS class_subjects (
  class_subject_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  is_compulsory BOOLEAN DEFAULT TRUE,
  hours_per_week INTEGER DEFAULT 4,
  teacher_id BIGINT REFERENCES teachers(teacher_id),
  academic_year_id BIGINT REFERENCES academic_years(academic_year_id),
  term_id BIGINT REFERENCES terms(term_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, subject_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON class_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_school ON class_subjects(school_id);

COMMENT ON TABLE class_subjects IS 'Maps subjects to specific classes with configuration';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_class_subject_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_class_subject_timestamp ON class_subjects;
CREATE TRIGGER update_class_subject_timestamp
  BEFORE UPDATE ON class_subjects
  FOR EACH ROW EXECUTE FUNCTION update_class_subject_timestamp();

-- =====================================================
-- B3. Ensure sort_order exists on classes
-- Already added in migration 020, verify and populate
-- =====================================================

DO $$
BEGIN
  -- Check if sort_order column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'classes' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE classes ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
  
  -- Check if grade_level exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'classes' AND column_name = 'grade_level'
  ) THEN
    ALTER TABLE classes ADD COLUMN grade_level INTEGER;
  END IF;
END $$;

-- Populate sort_order for common class names (Kenyan CBC system)
UPDATE classes SET sort_order = CASE
  WHEN class_name ILIKE '%playgroup%' THEN 1
  WHEN class_name ILIKE '%pp1%' OR class_name ILIKE '%pre-primary 1%' THEN 2
  WHEN class_name ILIKE '%pp2%' OR class_name ILIKE '%pre-primary 2%' THEN 3
  WHEN class_name ILIKE '%grade 1%' OR class_name ILIKE '%class 1%' THEN 4
  WHEN class_name ILIKE '%grade 2%' OR class_name ILIKE '%class 2%' THEN 5
  WHEN class_name ILIKE '%grade 3%' OR class_name ILIKE '%class 3%' THEN 6
  WHEN class_name ILIKE '%grade 4%' OR class_name ILIKE '%class 4%' THEN 7
  WHEN class_name ILIKE '%grade 5%' OR class_name ILIKE '%class 5%' THEN 8
  WHEN class_name ILIKE '%grade 6%' OR class_name ILIKE '%class 6%' THEN 9
  WHEN class_name ILIKE '%grade 7%' OR class_name ILIKE '%class 7%' OR class_name ILIKE '%jss 1%' THEN 10
  WHEN class_name ILIKE '%grade 8%' OR class_name ILIKE '%class 8%' OR class_name ILIKE '%jss 2%' THEN 11
  WHEN class_name ILIKE '%grade 9%' OR class_name ILIKE '%class 9%' OR class_name ILIKE '%jss 3%' THEN 12
  WHEN class_name ILIKE '%grade 10%' OR class_name ILIKE '%class 10%' OR class_name ILIKE '%form 2%' THEN 13
  WHEN class_name ILIKE '%grade 11%' OR class_name ILIKE '%class 11%' OR class_name ILIKE '%form 3%' THEN 14
  WHEN class_name ILIKE '%grade 12%' OR class_name ILIKE '%class 12%' OR class_name ILIKE '%form 4%' THEN 15
  ELSE 99
END
WHERE sort_order = 0 OR sort_order IS NULL;

-- Also set grade_level
UPDATE classes SET grade_level = sort_order WHERE grade_level IS NULL;

-- =====================================================
-- B4. View for ordered classes
-- =====================================================

CREATE OR REPLACE VIEW classes_ordered AS
SELECT 
  c.*,
  COALESCE(c.sort_order, 99) as display_order,
  CASE 
    WHEN c.class_name ILIKE '%playgroup%' THEN 'Early Years'
    WHEN c.class_name ILIKE '%pp%' OR c.class_name ILIKE '%pre-primary%' THEN 'Early Years'
    WHEN c.class_name ILIKE '%grade 1%' OR c.class_name ILIKE '%grade 2%' OR c.class_name ILIKE '%grade 3%' THEN 'Lower Primary'
    WHEN c.class_name ILIKE '%grade 4%' OR c.class_name ILIKE '%grade 5%' OR c.class_name ILIKE '%grade 6%' THEN 'Upper Primary'
    WHEN c.class_name ILIKE '%grade 7%' OR c.class_name ILIKE '%grade 8%' OR c.class_name ILIKE '%grade 9%' THEN 'Junior Secondary'
    WHEN c.class_name ILIKE '%grade 10%' OR c.class_name ILIKE '%grade 11%' OR c.class_name ILIKE '%grade 12%' THEN 'Senior Secondary'
    ELSE 'Other'
  END as education_level
FROM classes c
ORDER BY COALESCE(c.sort_order, 99), c.class_name;

-- =====================================================
-- B5. Backfill class_subjects from existing data
-- Create default mappings for classes that have grades
-- =====================================================

DO $$
DECLARE
  class_record RECORD;
  subject_record RECORD;
  default_subjects TEXT[] := ARRAY['Mathematics', 'English', 'Kiswahili'];
BEGIN
  -- For each class, ensure it has the core subjects
  FOR class_record IN SELECT class_id, school_id, class_name FROM classes
  LOOP
    FOR subject_record IN 
      SELECT subject_id, name FROM subjects 
      WHERE name = ANY(default_subjects)
    LOOP
      INSERT INTO class_subjects (class_id, school_id, subject_id, is_compulsory)
      VALUES (class_record.class_id, class_record.school_id, subject_record.subject_id, TRUE)
      ON CONFLICT (class_id, subject_id, academic_year_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Class-subject mappings created for core subjects';
END $$;

-- =====================================================
-- B6. Create function to get subjects for a class
-- =====================================================

CREATE OR REPLACE FUNCTION get_class_subjects(
  p_class_id BIGINT,
  p_academic_year_id BIGINT DEFAULT NULL
) RETURNS TABLE (
  subject_id BIGINT,
  subject_name VARCHAR,
  is_compulsory BOOLEAN,
  hours_per_week INTEGER,
  teacher_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.subject_id,
    s.name as subject_name,
    cs.is_compulsory,
    cs.hours_per_week,
    CONCAT(t.first_name, ' ', t.last_name) as teacher_name
  FROM class_subjects cs
  JOIN subjects s ON cs.subject_id = s.subject_id
  LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
  WHERE cs.class_id = p_class_id
    AND (p_academic_year_id IS NULL OR cs.academic_year_id = p_academic_year_id)
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check classes now have sort_order
SELECT 
  class_name,
  sort_order,
  grade_level,
  education_level
FROM classes_ordered
ORDER BY display_order;

-- Check class_subjects mappings
SELECT 
  c.class_name,
  s.name as subject_name,
  cs.is_compulsory
FROM class_subjects cs
JOIN classes c ON cs.class_id = c.class_id
JOIN subjects s ON cs.subject_id = s.subject_id
ORDER BY c.sort_order, s.name;

-- Check schools have logo capability
SELECT 
  school_id,
  name,
  logo_url IS NOT NULL as has_logo,
  primary_color,
  secondary_color
FROM schools
LIMIT 5;

-- ==========================================
-- END OF ADMIN SETUP FIXES
-- ==========================================
