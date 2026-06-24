-- Add unique constraints
BEGIN;

ALTER TABLE students 
DROP CONSTRAINT IF EXISTS uk_students_admission_school,
ADD CONSTRAINT uk_students_admission_school 
UNIQUE (admission_number, school_id);

ALTER TABLE students 
DROP CONSTRAINT IF EXISTS uk_students_email_school,
ADD CONSTRAINT uk_students_email_school 
UNIQUE (email, school_id);

ALTER TABLE teachers 
DROP CONSTRAINT IF EXISTS uk_teachers_staff_school,
ADD CONSTRAINT uk_teachers_staff_school 
UNIQUE (staff_number, school_id);

COMMIT;
