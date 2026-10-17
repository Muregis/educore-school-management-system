-- Sample Schools (id 22): Grade 2 Blue + Green streams
-- Run in Supabase SQL editor as a single script

-- 1) Blue on existing Grade 2
UPDATE classes
SET section = 'Blue', updated_at = NOW()
WHERE school_id = 22
  AND COALESCE(is_deleted, false) = false
  AND (class_id = 62 OR (class_name = 'Grade 2' AND (section IS NULL OR section = '' OR section = 'Blue')))
  AND class_id = (
    SELECT class_id FROM classes
    WHERE school_id = 22 AND COALESCE(is_deleted, false) = false
      AND (class_id = 62 OR class_name = 'Grade 2')
    ORDER BY CASE WHEN class_id = 62 THEN 0 ELSE 1 END
    LIMIT 1
  );

-- 2) Create Green if missing (minimal columns only)
INSERT INTO classes (school_id, class_name, section, status, is_deleted)
SELECT 22, 'Grade 2', 'Green', 'active', false
WHERE NOT EXISTS (
  SELECT 1 FROM classes
  WHERE school_id = 22
    AND class_name = 'Grade 2'
    AND section = 'Green'
    AND COALESCE(is_deleted, false) = false
);

-- 3) Assign students (by admission_number OR known student_id)
UPDATE students
SET class_id = (
      SELECT class_id FROM classes
      WHERE school_id = 22 AND class_name = 'Grade 2' AND section = 'Blue'
        AND COALESCE(is_deleted, false) = false
      ORDER BY class_id LIMIT 1
    ),
    class_name = 'Grade 2',
    updated_at = NOW()
WHERE school_id = 22
  AND COALESCE(is_deleted, false) = false
  AND (admission_number IN ('SMP-001','SMP-002','SMP-003') OR student_id IN (1093,1094,1095));

UPDATE students
SET class_id = (
      SELECT class_id FROM classes
      WHERE school_id = 22 AND class_name = 'Grade 2' AND section = 'Green'
        AND COALESCE(is_deleted, false) = false
      ORDER BY class_id LIMIT 1
    ),
    class_name = 'Grade 2',
    updated_at = NOW()
WHERE school_id = 22
  AND COALESCE(is_deleted, false) = false
  AND (admission_number IN ('SMP-004','SMP-005','SMP-046') OR student_id IN (1096,1097,1138));

-- 4) Align results to student class_id
UPDATE results r
SET class_id = s.class_id
FROM students s
WHERE r.school_id = 22
  AND s.school_id = 22
  AND r.student_id = s.student_id
  AND (s.admission_number IN ('SMP-001','SMP-002','SMP-003','SMP-004','SMP-005','SMP-046')
       OR s.student_id IN (1093,1094,1095,1096,1097,1138));

-- 5) School grading bands (insert if missing, then update)
INSERT INTO school_settings (school_id, setting_key, setting_value, setting_type)
SELECT 22, 'grading_bands',
  '[{"code":"EE1","parent":"EE","min":90,"max":100},{"code":"EE2","parent":"EE","min":80,"max":89},{"code":"ME1","parent":"ME","min":70,"max":79},{"code":"ME2","parent":"ME","min":65,"max":69},{"code":"AE1","parent":"AE","min":55,"max":64},{"code":"AE2","parent":"AE","min":50,"max":54},{"code":"BE1","parent":"BE","min":40,"max":49},{"code":"BE2","parent":"BE","min":0,"max":39}]',
  'json'
WHERE NOT EXISTS (
  SELECT 1 FROM school_settings WHERE school_id = 22 AND setting_key = 'grading_bands'
);

UPDATE school_settings
SET setting_value = '[{"code":"EE1","parent":"EE","min":90,"max":100},{"code":"EE2","parent":"EE","min":80,"max":89},{"code":"ME1","parent":"ME","min":70,"max":79},{"code":"ME2","parent":"ME","min":65,"max":69},{"code":"AE1","parent":"AE","min":55,"max":64},{"code":"AE2","parent":"AE","min":50,"max":54},{"code":"BE1","parent":"BE","min":40,"max":49},{"code":"BE2","parent":"BE","min":0,"max":39}]',
    setting_type = 'json'
WHERE school_id = 22 AND setting_key = 'grading_bands';

-- Verify
SELECT class_id, class_name, section FROM classes
WHERE school_id = 22 AND class_name = 'Grade 2' AND COALESCE(is_deleted,false)=false
ORDER BY section;
