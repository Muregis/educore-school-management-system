-- ==========================================
-- API FUNCTIONS FOR NEW FEATURES
-- Backend RPC functions for frontend integration
-- ==========================================

-- =====================================================
-- B1. Function to get student ledger balance
-- =====================================================

CREATE OR REPLACE FUNCTION get_student_ledger_balance(
  p_student_id BIGINT,
  p_school_id BIGINT
) RETURNS TABLE (
  total_expected DECIMAL(12,2),
  total_paid DECIMAL(12,2),
  balance DECIMAL(12,2),
  opening_balance DECIMAL(12,2),
  transport_fee DECIMAL(12,2),
  lunch_fee DECIMAL(12,2),
  base_fee DECIMAL(12,2)
) AS $$
DECLARE
  v_base_fee DECIMAL(12,2) := 0;
  v_transport DECIMAL(12,2) := 0;
  v_lunch DECIMAL(12,2) := 0;
  v_opening DECIMAL(12,2) := 0;
  v_paid DECIMAL(12,2) := 0;
  v_student_record RECORD;
BEGIN
  -- Get student details
  SELECT 
    transport_direction,
    transport_base_fee,
    lunch_enabled,
    lunch_daily_rate,
    lunch_days,
    COALESCE(opening_balance, 0) as opening_bal,
    opening_balance_type
  INTO v_student_record
  FROM students
  WHERE student_id = p_student_id AND school_id = p_school_id;
  
  -- Calculate transport fee (60% for one-way, 100% for two-way)
  IF v_student_record.transport_direction = 'one_way' THEN
    v_transport := COALESCE(v_student_record.transport_base_fee, 0) * 0.6;
  ELSIF v_student_record.transport_direction = 'two_way' THEN
    v_transport := COALESCE(v_student_record.transport_base_fee, 0);
  END IF;
  
  -- Calculate lunch fee
  IF v_student_record.lunch_enabled THEN
    v_lunch := COALESCE(v_student_record.lunch_daily_rate, 100) * COALESCE(v_student_record.lunch_days, 66);
  END IF;
  
  -- Get opening balance (negative if credit/prepaid)
  v_opening := CASE 
    WHEN v_student_record.opening_balance_type = 'credit' THEN -v_student_record.opening_bal
    ELSE v_student_record.opening_bal
  END;
  
  -- Calculate base fee from fee structure
  SELECT COALESCE(fs.tuition_fee, 0) + COALESCE(fs.activity_fee, 0) + COALESCE(fs.misc_fee, 0)
  INTO v_base_fee
  FROM fee_structures fs
  JOIN students s ON fs.class_id = s.class_id
  WHERE s.student_id = p_student_id
  LIMIT 1;
  
  -- Get total paid
  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM payments
  WHERE student_id = p_student_id AND status = 'paid';
  
  -- Return calculated values
  total_expected := v_base_fee + v_transport + v_lunch + GREATEST(v_opening, 0);
  total_paid := v_paid;
  balance := GREATEST(total_expected - total_paid, 0);
  opening_balance := v_opening;
  transport_fee := v_transport;
  lunch_fee := v_lunch;
  base_fee := v_base_fee;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- B2. Function to get class rankings
-- =====================================================

CREATE OR REPLACE FUNCTION get_class_rankings(
  p_class_id BIGINT,
  p_term_id BIGINT DEFAULT NULL
) RETURNS TABLE (
  student_id BIGINT,
  student_name TEXT,
  mean_score DECIMAL(5,2),
  total_marks INTEGER,
  max_possible INTEGER,
  grade VARCHAR(2),
  rank INTEGER,
  position_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH student_results AS (
    SELECT 
      r.student_id,
      CONCAT(s.first_name, ' ', s.last_name) as full_name,
      AVG((r.marks::DECIMAL / NULLIF(r.total_marks, 0)) * 100) as avg_percentage,
      SUM(r.marks) as total_marks_sum,
      SUM(r.total_marks) as max_possible_sum,
      ROW_NUMBER() OVER (ORDER BY AVG((r.marks::DECIMAL / NULLIF(r.total_marks, 0)) * 100) DESC) as student_rank
    FROM results r
    JOIN students s ON r.student_id = s.student_id
    WHERE r.class_id = p_class_id
      AND (p_term_id IS NULL OR r.term_id = p_term_id)
    GROUP BY r.student_id, s.first_name, s.last_name
  )
  SELECT 
    sr.student_id,
    sr.full_name,
    ROUND(sr.avg_percentage::DECIMAL, 2),
    sr.total_marks_sum::INTEGER,
    sr.max_possible_sum::INTEGER,
    CASE 
      WHEN sr.avg_percentage >= 80 THEN 'EE'
      WHEN sr.avg_percentage >= 65 THEN 'ME'
      WHEN sr.avg_percentage >= 50 THEN 'AE'
      ELSE 'BE'
    END::VARCHAR(2),
    sr.student_rank::INTEGER,
    CONCAT('Position ', sr.student_rank, ' of ', (SELECT COUNT(*) FROM student_results))::TEXT
  FROM student_results sr
  ORDER BY sr.student_rank;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- B3. Function to update class sort order
-- =====================================================

CREATE OR REPLACE FUNCTION update_class_sort_order(
  p_class_id BIGINT,
  p_sort_order INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE classes
  SET sort_order = p_sort_order,
      updated_at = NOW()
  WHERE class_id = p_class_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- B4. Function to get ordered classes for a school
-- =====================================================

CREATE OR REPLACE FUNCTION get_ordered_classes(
  p_school_id BIGINT
) RETURNS TABLE (
  class_id BIGINT,
  class_name VARCHAR,
  sort_order INTEGER,
  grade_level INTEGER,
  education_level VARCHAR,
  student_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.class_id,
    c.class_name,
    COALESCE(c.sort_order, 99)::INTEGER as sort_order,
    c.grade_level::INTEGER,
    CASE 
      WHEN c.class_name ILIKE '%playgroup%' THEN 'Early Years'
      WHEN c.class_name ILIKE '%pp%' OR c.class_name ILIKE '%pre-primary%' THEN 'Early Years'
      WHEN c.class_name ILIKE '%grade 1%' OR c.class_name ILIKE '%grade 2%' OR c.class_name ILIKE '%grade 3%' THEN 'Lower Primary'
      WHEN c.class_name ILIKE '%grade 4%' OR c.class_name ILIKE '%grade 5%' OR c.class_name ILIKE '%grade 6%' THEN 'Upper Primary'
      WHEN c.class_name ILIKE '%grade 7%' OR c.class_name ILIKE '%grade 8%' OR c.class_name ILIKE '%grade 9%' THEN 'Junior Secondary'
      ELSE 'Other'
    END::VARCHAR as education_level,
    COUNT(s.student_id) as student_count
  FROM classes c
  LEFT JOIN students s ON c.class_id = s.class_id AND s.status = 'active'
  WHERE c.school_id = p_school_id
  GROUP BY c.class_id, c.class_name, c.sort_order, c.grade_level
  ORDER BY COALESCE(c.sort_order, 99), c.class_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- B5. Function to get subjects for a class
-- =====================================================

CREATE OR REPLACE FUNCTION get_class_subjects(
  p_class_id BIGINT,
  p_academic_year_id BIGINT DEFAULT NULL
) RETURNS TABLE (
  subject_id BIGINT,
  subject_name VARCHAR,
  is_compulsory BOOLEAN,
  hours_per_week INTEGER,
  teacher_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.subject_id,
    s.name as subject_name,
    COALESCE(cs.is_compulsory, TRUE) as is_compulsory,
    COALESCE(cs.hours_per_week, 4)::INTEGER as hours_per_week,
    CONCAT(t.first_name, ' ', t.last_name)::TEXT as teacher_name
  FROM class_subjects cs
  JOIN subjects s ON cs.subject_id = s.subject_id
  LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
  WHERE cs.class_id = p_class_id
    AND (p_academic_year_id IS NULL OR cs.academic_year_id = p_academic_year_id)
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- B6. Function to assign subject to class
-- =====================================================

CREATE OR REPLACE FUNCTION assign_subject_to_class(
  p_class_id BIGINT,
  p_subject_id BIGINT,
  p_school_id BIGINT,
  p_is_compulsory BOOLEAN DEFAULT TRUE,
  p_hours_per_week INTEGER DEFAULT 4,
  p_teacher_id BIGINT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_mapping_id BIGINT;
BEGIN
  INSERT INTO class_subjects (
    class_id,
    subject_id,
    school_id,
    is_compulsory,
    hours_per_week,
    teacher_id
  ) VALUES (
    p_class_id,
    p_subject_id,
    p_school_id,
    p_is_compulsory,
    p_hours_per_week,
    p_teacher_id
  )
  ON CONFLICT (class_id, subject_id, academic_year_id) 
  DO UPDATE SET
    is_compulsory = EXCLUDED.is_compulsory,
    hours_per_week = EXCLUDED.hours_per_week,
    teacher_id = EXCLUDED.teacher_id,
    updated_at = NOW()
  RETURNING class_subject_id INTO v_mapping_id;
  
  RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Test student ledger balance
-- SELECT * FROM get_student_ledger_balance(1, 1);

-- Test class rankings
-- SELECT * FROM get_class_rankings(1, NULL);

-- Test ordered classes
-- SELECT * FROM get_ordered_classes(1);

-- ==========================================
-- END OF API FUNCTIONS
-- ==========================================
