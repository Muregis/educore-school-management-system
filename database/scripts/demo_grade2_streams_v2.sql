-- Use if minimal INSERT fails because academic_year is NOT NULL
UPDATE classes SET section = 'Blue', updated_at = NOW()
WHERE school_id = 22 AND class_id = 62;

INSERT INTO classes (school_id, class_name, section, status, is_deleted, academic_year)
SELECT 22, 'Grade 2', 'Green', 'active', false,
       COALESCE((SELECT academic_year FROM classes WHERE class_id = 62), EXTRACT(YEAR FROM NOW())::int)
WHERE NOT EXISTS (
  SELECT 1 FROM classes WHERE school_id = 22 AND class_name = 'Grade 2' AND section = 'Green'
    AND COALESCE(is_deleted,false)=false
);

UPDATE students SET class_id = 62, class_name = 'Grade 2', updated_at = NOW()
WHERE school_id = 22 AND (admission_number IN ('SMP-001','SMP-002','SMP-003') OR student_id IN (1093,1094,1095));

UPDATE students SET class_id = (SELECT class_id FROM classes WHERE school_id=22 AND class_name='Grade 2' AND section='Green' AND COALESCE(is_deleted,false)=false LIMIT 1),
    class_name = 'Grade 2', updated_at = NOW()
WHERE school_id = 22 AND (admission_number IN ('SMP-004','SMP-005','SMP-046') OR student_id IN (1096,1097,1138));

UPDATE results r SET class_id = s.class_id FROM students s
WHERE r.school_id=22 AND s.school_id=22 AND r.student_id=s.student_id
  AND s.student_id IN (1093,1094,1095,1096,1097,1138);
