-- Migration: Sync existing teachers to hr_staff table
-- Run this to sync all existing teacher data to HR staff table

-- Insert teachers into hr_staff (skipping duplicates)
INSERT INTO hr_staff (
  school_id,
  full_name,
  email,
  phone,
  department,
  job_title,
  contract_type,
  start_date,
  status,
  is_deleted,
  created_at,
  updated_at
)
SELECT 
  t.school_id,
  CONCAT(t.first_name, ' ', t.last_name) AS full_name,
  t.email,
  t.phone,
  COALESCE(t.department, 'Academic') AS department,
  COALESCE(t.qualification, 'Teacher') AS job_title,
  'Permanent' AS contract_type,
  t.hire_date AS start_date,
  COALESCE(t.status, 'active') AS status,
  FALSE AS is_deleted,
  COALESCE(t.created_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM teachers t
LEFT JOIN hr_staff h ON t.email = h.email AND t.school_id = h.school_id
WHERE t.is_deleted = FALSE
  AND h.staff_id IS NULL  -- Only insert if not already in hr_staff
  AND t.email IS NOT NULL;  -- Ensure email exists for linking

-- Update teachers table to link to the newly created hr_staff records
UPDATE teachers t
SET staff_id = h.staff_id
FROM hr_staff h
WHERE t.email = h.email 
  AND t.school_id = h.school_id
  AND t.staff_id IS NULL;

-- Report results
SELECT 
  'Teachers synced to HR staff' AS action,
  COUNT(*) AS count
FROM teachers t
JOIN hr_staff h ON t.email = h.email AND t.school_id = h.school_id;
