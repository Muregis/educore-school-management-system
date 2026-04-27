-- Migration: Create KNEC grade boundaries configuration
-- Enables automatic grade calculation and ranking

CREATE TABLE IF NOT EXISTS knec_grades (
  grade_id SERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  subject_category VARCHAR(50) NULL,
  min_percentage DECIMAL(5,2) NOT NULL,
  max_percentage DECIMAL(5,2) NOT NULL,
  knec_grade VARCHAR(10) NOT NULL,
  grade_points DECIMAL(3,1) NOT NULL,
  description VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, knec_grade)
);

CREATE INDEX IF NOT EXISTS idx_knec_grades_school ON knec_grades(school_id);
CREATE INDEX IF NOT EXISTS idx_knec_grades_range ON knec_grades(min_percentage, max_percentage);

-- RLS for tenant isolation
ALTER TABLE knec_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY knec_grades_school_isolation ON knec_grades
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Insert default KNEC grades for CBC (Kenyan curriculum)
INSERT INTO knec_grades (school_id, subject_category, min_percentage, max_percentage, knec_grade, grade_points, description)
VALUES 
  (1, NULL, 80.00, 100.00, 'EE1', 4.0, 'Excellent'),
  (1, NULL, 75.00, 79.99, 'EE2', 3.5, 'Very Good'),
  (1, NULL, 70.00, 74.99, 'ME1', 3.0, 'Good'),
  (1, NULL, 65.00, 69.99, 'ME2', 2.5, 'Average'),
  (1, NULL, 60.00, 64.99, 'ME3', 2.0, 'Satisfactory'),
  (1, NULL, 55.00, 59.99, 'MM1', 1.5, 'Below Average'),
  (1, NULL, 45.00, 54.99, 'MM2', 1.0, 'Weak'),
  (1, NULL, 40.00, 44.99, 'MM3', 0.5, 'Very Weak'),
  (1, NULL, 0.00, 39.99, 'EE9', 0.0, 'Fail');

COMMENT ON TABLE knec_grades IS 'KNEC grade boundaries for automatic grading';
COMMENT ON COLUMN knec_grades.knec_grade IS 'Grade code: EE1 (highest) to EE9 (lowest)';
COMMENT ON COLUMN knec_grades.grade_points IS 'Grade point value for mean calculation';
