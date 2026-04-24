-- EduCore Structural Improvements (Additive Only)
-- Safe migration - creates new tables/columns without breaking existing data
-- Run this after hotfixes are deployed and stable

-- =====================================================
-- B1. Student Opening Balance (for onboarding existing students)
-- =====================================================

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN students.opening_balance IS 
'Initial balance when student was onboarded from another system. Added to expected fees in balance calculation.';

-- =====================================================
-- B2. Student-Parent Mapping (Many-to-Many)
-- Replaces fragile users.student_id linkage
-- =====================================================

CREATE TABLE IF NOT EXISTS student_parent_mapping (
  mapping_id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  parent_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  relationship VARCHAR(20) CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  is_primary BOOLEAN DEFAULT FALSE,
  can_view_grades BOOLEAN DEFAULT TRUE,
  can_view_fees BOOLEAN DEFAULT TRUE,
  can_view_attendance BOOLEAN DEFAULT TRUE,
  can_make_payments BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, parent_user_id)
);

-- Index for quick parent lookups
CREATE INDEX IF NOT EXISTS idx_parent_mapping_parent ON student_parent_mapping(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_mapping_student ON student_parent_mapping(student_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_mapping_timestamp ON student_parent_mapping;
CREATE TRIGGER update_mapping_timestamp
  BEFORE UPDATE ON student_parent_mapping
  FOR EACH ROW EXECUTE FUNCTION update_mapping_timestamp();

-- =====================================================
-- B3. Transport Enrollment (per student per term)
-- =====================================================

CREATE TABLE IF NOT EXISTS transport_enrollments (
  enrollment_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  academic_year_id BIGINT REFERENCES academic_years(academic_year_id),
  term_id BIGINT REFERENCES terms(term_id),
  route_name VARCHAR(100),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('one_way', 'two_way')),
  base_fee DECIMAL(10,2) NOT NULL,
  calculated_fee DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_student ON transport_enrollments(student_id, term_id);
CREATE INDEX IF NOT EXISTS idx_transport_term ON transport_enrollments(term_id, is_active);

-- Function to calculate transport fee with multiplier
CREATE OR REPLACE FUNCTION calculate_transport_fee(
  base_fee DECIMAL,
  direction VARCHAR
) RETURNS DECIMAL AS $$
BEGIN
  IF direction = 'one_way' THEN
    RETURN ROUND(base_fee * 0.6, 2);  -- 60% for one-way
  ELSE
    RETURN base_fee;                   -- 100% for two-way
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate fee
CREATE OR REPLACE FUNCTION set_transport_fee()
RETURNS TRIGGER AS $$
BEGIN
  NEW.calculated_fee = calculate_transport_fee(NEW.base_fee, NEW.direction);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transport_fee ON transport_enrollments;
CREATE TRIGGER set_transport_fee
  BEFORE INSERT OR UPDATE ON transport_enrollments
  FOR EACH ROW EXECUTE FUNCTION set_transport_fee();

-- =====================================================
-- B4. Lunch Enrollment (per student per term)
-- =====================================================

CREATE TABLE IF NOT EXISTS lunch_enrollments (
  enrollment_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  academic_year_id BIGINT REFERENCES academic_years(academic_year_id),
  term_id BIGINT REFERENCES terms(term_id),
  meal_type VARCHAR(20) DEFAULT 'full' CHECK (meal_type IN ('full', 'half', 'special')),
  fee_amount DECIMAL(10,2) NOT NULL,
  days_per_week INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_lunch_student ON lunch_enrollments(student_id, term_id);
CREATE INDEX IF NOT EXISTS idx_lunch_term ON lunch_enrollments(term_id, is_active);

-- =====================================================
-- B5. Class Ordering & Grade Level
-- =====================================================

ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS sort_order INTEGER;

ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS grade_level INTEGER;

ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS next_class_id BIGINT REFERENCES classes(class_id);

COMMENT ON COLUMN classes.sort_order IS 'Display order (Playgroup=0, PP1=1, etc)';
COMMENT ON COLUMN classes.grade_level IS 'Academic progression level for promotion logic';
COMMENT ON COLUMN classes.next_class_id IS 'Next class in progression chain (for auto-promotion)';

-- Update existing classes with proper ordering
UPDATE classes SET sort_order = 0, grade_level = 0 WHERE class_name ILIKE '%playgroup%';
UPDATE classes SET sort_order = 1, grade_level = 1 WHERE class_name ILIKE '%pp1%' OR class_name ILIKE '%pre-primary 1%';
UPDATE classes SET sort_order = 2, grade_level = 2 WHERE class_name ILIKE '%pp2%' OR class_name ILIKE '%pre-primary 2%';
UPDATE classes SET sort_order = 3, grade_level = 3 WHERE class_name ILIKE '%grade 1%' OR class_name = 'G1';
UPDATE classes SET sort_order = 4, grade_level = 4 WHERE class_name ILIKE '%grade 2%' OR class_name = 'G2';
UPDATE classes SET sort_order = 5, grade_level = 5 WHERE class_name ILIKE '%grade 3%' OR class_name = 'G3';
UPDATE classes SET sort_order = 6, grade_level = 6 WHERE class_name ILIKE '%grade 4%' OR class_name = 'G4';
UPDATE classes SET sort_order = 7, grade_level = 7 WHERE class_name ILIKE '%grade 5%' OR class_name = 'G5';
UPDATE classes SET sort_order = 8, grade_level = 8 WHERE class_name ILIKE '%grade 6%' OR class_name = 'G6';
UPDATE classes SET sort_order = 9, grade_level = 9 WHERE class_name ILIKE '%grade 7%' OR class_name = 'G7';
UPDATE classes SET sort_order = 10, grade_level = 10 WHERE class_name ILIKE '%grade 8%' OR class_name = 'G8';
UPDATE classes SET sort_order = 11, grade_level = 11 WHERE class_name ILIKE '%grade 9%' OR class_name = 'G9';

-- =====================================================
-- B6. Class-Subjects Mapping (per-class subject configuration)
-- =====================================================

CREATE TABLE IF NOT EXISTS class_subjects (
  mapping_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_name VARCHAR(100) NOT NULL,
  subject_code VARCHAR(20),
  is_core BOOLEAN DEFAULT TRUE,
  hours_per_week INTEGER DEFAULT 5,
  max_marks DECIMAL(5,2) DEFAULT 100,
  pass_mark DECIMAL(5,2) DEFAULT 40,
  grading_scale VARCHAR(10) DEFAULT 'CBC' CHECK (grading_scale IN ('KNEC', 'CBC', 'custom')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, subject_name)
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id, is_active);

-- =====================================================
-- B7. MPesa Transaction Idempotency
-- =====================================================

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
ADD COLUMN IF NOT EXISTS mpesa_receipt_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS mpesa_phone_number VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency 
ON payments(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- =====================================================
-- B8. Fee Balance Ledger (Immutable Transaction Log)
-- =====================================================

CREATE TABLE IF NOT EXISTS fee_balance_ledger (
  ledger_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  academic_year_id BIGINT REFERENCES academic_years(academic_year_id),
  term_id BIGINT REFERENCES terms(term_id),
  transaction_type VARCHAR(20) NOT NULL 
    CHECK (transaction_type IN ('opening', 'charge', 'payment', 'adjustment', 'carry_forward', 'refund')),
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(50),  -- 'payment', 'invoice', 'transport', 'lunch', 'manual', 'system'
  reference_id BIGINT,
  description TEXT,
  created_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_ledger_student_date ON fee_balance_ledger(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_school_date ON fee_balance_ledger(school_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON fee_balance_ledger(reference_type, reference_id);

-- =====================================================
-- B9. Library Table Enhancement (if missing)
-- =====================================================

CREATE TABLE IF NOT EXISTS library_books (
  book_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  isbn VARCHAR(20),
  category VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  available INTEGER DEFAULT 1,
  shelf_location VARCHAR(50),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by BIGINT REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_library_school ON library_books(school_id, category);

-- =====================================================
-- RLS Policies (Row Level Security)
-- =====================================================

ALTER TABLE student_parent_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lunch_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_balance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS mapping_isolation ON student_parent_mapping;
DROP POLICY IF EXISTS transport_isolation ON transport_enrollments;
DROP POLICY IF EXISTS lunch_isolation ON lunch_enrollments;
DROP POLICY IF EXISTS ledger_isolation ON fee_balance_ledger;
DROP POLICY IF EXISTS library_isolation ON library_books;
DROP POLICY IF EXISTS class_subjects_isolation ON class_subjects;

-- School isolation policies
CREATE POLICY mapping_isolation ON student_parent_mapping
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM students WHERE students.student_id = student_parent_mapping.student_id AND students.school_id = get_school_id()));

CREATE POLICY transport_isolation ON transport_enrollments
  FOR ALL TO authenticated
  USING (school_id = get_school_id());

CREATE POLICY lunch_isolation ON lunch_enrollments
  FOR ALL TO authenticated
  USING (school_id = get_school_id());

CREATE POLICY ledger_isolation ON fee_balance_ledger
  FOR ALL TO authenticated
  USING (school_id = get_school_id());

CREATE POLICY library_isolation ON library_books
  FOR ALL TO authenticated
  USING (school_id = get_school_id());

CREATE POLICY class_subjects_isolation ON class_subjects
  FOR ALL TO authenticated
  USING (school_id = get_school_id());

-- =====================================================
-- Backfill: Migrate Existing Data
-- =====================================================

-- Migrate existing parent linkages to new mapping table
INSERT INTO student_parent_mapping (student_id, parent_user_id, relationship, is_primary)
SELECT 
  s.student_id,
  u.user_id,
  COALESCE(s.parent_relationship, 'guardian'),
  TRUE
FROM students s
JOIN users u ON u.student_id = s.student_id
WHERE u.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 FROM student_parent_mapping 
    WHERE student_id = s.student_id AND parent_user_id = u.user_id
  )
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE student_parent_mapping IS 'Many-to-many relationship between students and parent users. Replaces the single users.student_id linkage for better flexibility.';

-- =====================================================
-- Done
-- =====================================================
SELECT 'Structural improvements migration complete' as status;
