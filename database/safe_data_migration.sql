-- =====================================================
-- SAFE DATA MIGRATION SCRIPT
-- Only contains SQL - No JavaScript code
-- =====================================================

-- =====================================================
-- PHASE 1: INITIALIZE ACADEMIC YEARS FROM EXISTING DATA
-- =====================================================

-- Create academic years from existing classes.academic_year and school_settings
INSERT INTO academic_years (
  school_id,
  year_label,
  start_date,
  end_date,
  status,
  legacy_year_value,
  is_current,
  created_at,
  updated_at
)
SELECT DISTINCT
  s.school_id,
  COALESCE(ss.setting_value, c.academic_year::TEXT) as year_label,
  CASE
    WHEN c.academic_year IS NOT NULL THEN
      DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' * (c.academic_year - EXTRACT(YEAR FROM CURRENT_DATE))
    ELSE CURRENT_DATE
  END as start_date,
  CASE
    WHEN c.academic_year IS NOT NULL THEN
      DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' * (c.academic_year - EXTRACT(YEAR FROM CURRENT_DATE)) + INTERVAL '1 year' - INTERVAL '1 day'
    ELSE CURRENT_DATE + INTERVAL '1 year' - INTERVAL '1 day'
  END as end_date,
  'active' as status,
  c.academic_year as legacy_year_value,
  CASE WHEN ss.setting_value = c.academic_year::TEXT THEN TRUE ELSE FALSE END as is_current,
  NOW(),
  NOW()
FROM schools s
CROSS JOIN (
  SELECT DISTINCT academic_year
  FROM classes
  WHERE academic_year IS NOT NULL
) c
LEFT JOIN school_settings ss ON ss.school_id = s.school_id
  AND ss.setting_key = 'academic_year'
WHERE NOT s.is_deleted
  AND NOT EXISTS (
    SELECT 1 FROM academic_years ay
    WHERE ay.school_id = s.school_id
    AND ay.year_label = COALESCE(ss.setting_value, c.academic_year::TEXT)
  );

-- Set current academic year flags
UPDATE academic_years
SET is_current = TRUE
WHERE school_id IN (
  SELECT school_id
  FROM school_settings
  WHERE setting_key = 'academic_year'
  AND setting_value = academic_years.year_label
);

-- =====================================================
-- PHASE 2: INITIALIZE TERMS FROM EXISTING DATA
-- =====================================================

-- Create terms from existing invoices.term, payments.term, and school_settings
INSERT INTO terms (
  school_id,
  academic_year_id,
  term_name,
  term_order,
  start_date,
  end_date,
  status,
  legacy_term_value,
  is_current,
  created_at,
  updated_at
)
SELECT DISTINCT
  s.school_id,
  ay.academic_year_id,
  COALESCE(ss_term.setting_value, t.term_value) as term_name,
  CASE
    WHEN COALESCE(ss_term.setting_value, t.term_value) LIKE '%1%' THEN 1
    WHEN COALESCE(ss_term.setting_value, t.term_value) LIKE '%2%' THEN 2
    WHEN COALESCE(ss_term.setting_value, t.term_value) LIKE '%3%' THEN 3
    ELSE 1
  END as term_order,
  CURRENT_DATE as start_date, -- Placeholder, should be updated with actual dates
  CURRENT_DATE + INTERVAL '3 months' as end_date, -- Placeholder
  'active' as status,
  t.term_value as legacy_term_value,
  CASE WHEN ss_term.setting_value = t.term_value THEN TRUE ELSE FALSE END as is_current,
  NOW(),
  NOW()
FROM schools s
CROSS JOIN (
  SELECT DISTINCT term as term_value
  FROM (
    SELECT DISTINCT term FROM invoices
    UNION
    SELECT DISTINCT term FROM payments
  ) terms
  WHERE term IS NOT NULL
) t
LEFT JOIN school_settings ss_term ON ss_term.school_id = s.school_id
  AND ss_term.setting_key = 'current_term'
LEFT JOIN academic_years ay ON ay.school_id = s.school_id
  AND ay.is_current = TRUE
WHERE NOT s.is_deleted
  AND ay.academic_year_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM terms tm
    WHERE tm.school_id = s.school_id
    AND tm.term_name = COALESCE(ss_term.setting_value, t.term_value)
  );

-- Set current term flags
UPDATE terms
SET is_current = TRUE
WHERE school_id IN (
  SELECT school_id
  FROM school_settings
  WHERE setting_key = 'current_term'
  AND setting_value = terms.term_name
);

-- =====================================================
-- PHASE 3: INITIALIZE STUDENT ENROLLMENTS FROM EXISTING DATA
-- =====================================================

-- Create current enrollments from students.class_id
INSERT INTO student_enrollments (
  student_id,
  class_id,
  academic_year_id,
  enrollment_date,
  status,
  enrollment_type,
  is_current,
  created_at,
  updated_at
)
SELECT
  s.student_id,
  s.class_id,
  ay.academic_year_id,
  COALESCE(s.admission_date, s.created_at::DATE) as enrollment_date,
  CASE
    WHEN s.status = 'active' THEN 'active'
    WHEN s.status = 'inactive' THEN 'withdrawn'
    WHEN s.status = 'graduated' THEN 'graduated'
    WHEN s.status = 'transferred' THEN 'transferred'
    ELSE 'active'
  END as status,
  'regular' as enrollment_type,
  TRUE as is_current,
  NOW(),
  NOW()
FROM students s
LEFT JOIN classes c ON c.class_id = s.class_id
LEFT JOIN academic_years ay ON ay.school_id = s.school_id
  AND ay.legacy_year_value = c.academic_year
WHERE s.class_id IS NOT NULL
  AND NOT s.is_deleted
  AND ay.academic_year_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM student_enrollments se
    WHERE se.student_id = s.student_id
    AND se.is_current = TRUE
  );

-- =====================================================
-- PHASE 4: INITIALIZE FEE BALANCE LEDGER FROM EXISTING DATA
-- =====================================================

-- Create ledger entries from existing invoices
INSERT INTO fee_balance_ledger (
  school_id,
  student_id,
  academic_year_id,
  term_id,
  transaction_type,
  transaction_date,
  amount,
  balance_before,
  balance_after,
  reference_type,
  reference_id,
  description,
  created_at
)
SELECT
  i.school_id,
  i.student_id,
  COALESCE(ay.academic_year_id, ay2.academic_year_id) as academic_year_id,
  COALESCE(tm.term_id, tm2.term_id) as term_id,
  'charge' as transaction_type,
  i.created_at::DATE as transaction_date,
  i.total as amount,
  0 as balance_before,
  i.total as balance_after,
  'invoice' as reference_type,
  i.invoice_id as reference_id,
  'Migrated from existing invoice' as description,
  NOW()
FROM invoices i
LEFT JOIN academic_years ay ON ay.school_id = i.school_id
  AND ay.year_label = i.academic_year
LEFT JOIN terms tm ON tm.school_id = i.school_id
  AND tm.legacy_term_value = i.term
-- Fallback: try to match by current academic year if direct match fails
LEFT JOIN academic_years ay2 ON ay2.school_id = i.school_id
  AND ay2.is_current = TRUE
LEFT JOIN terms tm2 ON tm2.school_id = i.school_id
  AND tm2.is_current = TRUE
WHERE NOT i.is_deleted
  AND COALESCE(ay.academic_year_id, ay2.academic_year_id) IS NOT NULL -- Ensure we have academic_year_id
  AND NOT EXISTS (
    SELECT 1 FROM fee_balance_ledger fbl
    WHERE fbl.reference_type = 'invoice'
    AND fbl.reference_id = i.invoice_id
  );

-- Create ledger entries from existing payments
INSERT INTO fee_balance_ledger (
  school_id,
  student_id,
  academic_year_id,
  term_id,
  transaction_type,
  transaction_date,
  amount,
  balance_before,
  balance_after,
  reference_type,
  reference_id,
  description,
  created_at
)
SELECT
  p.school_id,
  p.student_id,
  COALESCE(ay.academic_year_id, ay2.academic_year_id) as academic_year_id,
  COALESCE(tm.term_id, tm2.term_id) as term_id,
  'payment' as transaction_type,
  p.payment_date,
  -p.amount as amount, -- Negative for payments
  COALESCE(i.balance + p.amount, p.amount) as balance_before, -- Approximate
  COALESCE(i.balance, 0) as balance_after,
  'payment' as reference_type,
  p.payment_id as reference_id,
  'Migrated from existing payment' as description,
  NOW()
FROM payments p
LEFT JOIN invoices i ON i.invoice_id = p.invoice_id
LEFT JOIN academic_years ay ON ay.school_id = p.school_id
  AND ay.year_label = p.term -- This might need adjustment based on your data
LEFT JOIN terms tm ON tm.school_id = p.school_id
  AND tm.legacy_term_value = p.term
-- Fallback: try to match by current academic year if direct match fails
LEFT JOIN academic_years ay2 ON ay2.school_id = p.school_id
  AND ay2.is_current = TRUE
LEFT JOIN terms tm2 ON tm2.school_id = p.school_id
  AND tm2.is_current = TRUE
WHERE NOT p.is_deleted
  AND p.status = 'paid'
  AND COALESCE(ay.academic_year_id, ay2.academic_year_id) IS NOT NULL -- Ensure we have academic_year_id
  AND NOT EXISTS (
    SELECT 1 FROM fee_balance_ledger fbl
    WHERE fbl.reference_type = 'payment'
    AND fbl.reference_id = p.payment_id
  );

-- =====================================================
-- PHASE 5: CREATE MAPPING TABLES
-- =====================================================

-- Map existing classes to academic years
INSERT INTO class_academic_year_mapping (
  class_id,
  academic_year_id,
  is_primary,
  created_at
)
SELECT
  c.class_id,
  ay.academic_year_id,
  TRUE as is_primary,
  NOW()
FROM classes c
LEFT JOIN academic_years ay ON ay.school_id = c.school_id
  AND ay.legacy_year_value = c.academic_year
WHERE NOT c.is_deleted
  AND ay.academic_year_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM class_academic_year_mapping cam
    WHERE cam.class_id = c.class_id
  );

-- Map existing invoices to terms
INSERT INTO invoice_term_mapping (
  invoice_id,
  term_id,
  is_primary,
  created_at
)
SELECT
  i.invoice_id,
  tm.term_id,
  TRUE as is_primary,
  NOW()
FROM invoices i
LEFT JOIN terms tm ON tm.school_id = i.school_id
  AND tm.legacy_term_value = i.term
WHERE NOT i.is_deleted
  AND tm.term_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM invoice_term_mapping itm
    WHERE itm.invoice_id = i.invoice_id
  );

-- =====================================================
-- PHASE 6: RECORD MIGRATION CHECKPOINTS
-- =====================================================

-- Record successful completion of each phase
INSERT INTO migration_checkpoints (
  migration_phase,
  school_id,
  checkpoint_data,
  status,
  created_at,
  updated_at
)
SELECT
  'data_migration' as migration_phase,
  school_id,
  jsonb_build_object(
    'academic_years_count', (SELECT COUNT(*) FROM academic_years WHERE school_id = schools.school_id),
    'terms_count', (SELECT COUNT(*) FROM terms WHERE school_id = schools.school_id),
    'enrollments_count', (SELECT COUNT(*) FROM student_enrollments se JOIN students s ON s.student_id = se.student_id WHERE s.school_id = schools.school_id),
    'ledger_entries_count', (SELECT COUNT(*) FROM fee_balance_ledger WHERE school_id = schools.school_id)
  ) as checkpoint_data,
  'completed' as status,
  NOW(),
  NOW()
FROM schools
WHERE NOT is_deleted;