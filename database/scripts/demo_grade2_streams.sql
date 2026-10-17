-- Sample Schools (school_id = 22): Grade 2 Blue + Green streams + default grading_bands
UPDATE classes SET section = 'Blue', updated_at = now() WHERE school_id = 22 AND class_id = 62;

INSERT INTO classes (school_id, class_name, section, status, is_deleted, class_order, created_at, updated_at)
SELECT 22, 'Grade 2', 'Green', 'active', false, 2, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM classes
  WHERE school_id = 22 AND class_name = 'Grade 2' AND section = 'Green'
    AND COALESCE(is_deleted, false) = false
);

WITH green AS (
  SELECT class_id FROM classes
  WHERE school_id = 22 AND class_name = 'Grade 2' AND section = 'Green'
    AND COALESCE(is_deleted, false) = false
  LIMIT 1
)
UPDATE students s
SET class_id = green.class_id, class_name = 'Grade 2', updated_at = now()
FROM green
WHERE s.school_id = 22
  AND s.admission_number IN ('SMP-004', 'SMP-005', 'SMP-046');

UPDATE results r
SET class_id = s.class_id
FROM students s
WHERE r.school_id = 22 AND r.student_id = s.student_id
  AND s.admission_number IN ('SMP-001','SMP-002','SMP-003','SMP-004','SMP-005','SMP-046');

INSERT INTO school_settings (school_id, setting_key, setting_value, setting_type)
VALUES (
  22,
  'grading_bands',
  '[{"code":"EE1","parent":"EE","min":90,"max":100,"label":"Exceeds Expectations (1)"},{"code":"EE2","parent":"EE","min":80,"max":89,"label":"Exceeds Expectations (2)"},{"code":"ME1","parent":"ME","min":70,"max":79,"label":"Meets Expectations (1)"},{"code":"ME2","parent":"ME","min":65,"max":69,"label":"Meets Expectations (2)"},{"code":"AE1","parent":"AE","min":55,"max":64,"label":"Approaches Expectations (1)"},{"code":"AE2","parent":"AE","min":50,"max":54,"label":"Approaches Expectations (2)"},{"code":"BE1","parent":"BE","min":40,"max":49,"label":"Below Expectations (1)"},{"code":"BE2","parent":"BE","min":0,"max":39,"label":"Below Expectations (2)"}]',
  'json'
)
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, setting_type = 'json';
