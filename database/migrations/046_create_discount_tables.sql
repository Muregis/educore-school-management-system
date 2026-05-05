-- Migration: 046_create_discount_tables
-- Description: Add discount system for sibling, staff, and custom discounts

-- Discount configurations per school
CREATE TABLE IF NOT EXISTS discount_configs (
  config_id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id),
  discount_type VARCHAR(30) NOT NULL,
  -- Types: sibling_2nd, sibling_3rd, sibling_4th_plus,
  --        staff_child, custom, scholarship, bursary
  discount_value DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- Percentage (0-100)
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(school_id, discount_type)
);

-- Student discount assignments
CREATE TABLE IF NOT EXISTS student_discounts (
  discount_id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id),
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  discount_type VARCHAR(30) NOT NULL,
  discount_value DECIMAL(5,2) NOT NULL,
  -- Actual % applied to this student
  discount_amount DECIMAL(10,2),
  -- Actual KES amount saved (calculated on fee generation)
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  approved_by INTEGER REFERENCES users(user_id),
  approved_at TIMESTAMP,
  starts_at DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for sibling detection
CREATE INDEX IF NOT EXISTS idx_students_parent_phone
ON students(school_id, parent_phone)
WHERE is_deleted = false;

-- Index for student discounts
CREATE INDEX IF NOT EXISTS idx_student_discounts_student
ON student_discounts(student_id, school_id)
WHERE is_active = true;

-- Index for discount configs
CREATE INDEX IF NOT EXISTS idx_discount_configs_school
ON discount_configs(school_id, discount_type)
WHERE is_active = true;

-- Function to seed default discount configs for a school
CREATE OR REPLACE FUNCTION seed_default_discount_configs(p_school_id INTEGER, p_created_by INTEGER DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO discount_configs (school_id, discount_type, discount_value, is_active, created_by)
  VALUES
    (p_school_id, 'sibling_2nd', 10, true, p_created_by),
    (p_school_id, 'sibling_3rd', 20, true, p_created_by),
    (p_school_id, 'sibling_4th_plus', 30, true, p_created_by),
    (p_school_id, 'staff_child', 50, true, p_created_by),
    (p_school_id, 'scholarship', 100, true, p_created_by),
    (p_school_id, 'bursary', 50, true, p_created_by)
  ON CONFLICT (school_id, discount_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE discount_configs IS 'School-wide discount percentage configurations';
COMMENT ON TABLE student_discounts IS 'Individual student discount assignments';
COMMENT ON FUNCTION seed_default_discount_configs IS 'Seeds default discount configs when school is set up';

-- ROLLBACK:
-- DROP TABLE IF EXISTS student_discounts;
-- DROP TABLE IF EXISTS discount_configs;
-- DROP FUNCTION IF EXISTS seed_default_discount_configs(INTEGER, INTEGER);
-- DROP INDEX IF EXISTS idx_students_parent_phone;
