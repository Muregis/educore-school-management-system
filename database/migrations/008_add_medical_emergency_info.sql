-- Migration: Add Medical and Emergency Info to students table
-- For student health records and emergency contacts

-- Add medical info columns
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10) NULL,
ADD COLUMN IF NOT EXISTS allergies TEXT NULL,
ADD COLUMN IF NOT EXISTS medical_conditions TEXT NULL,
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(160) NULL,
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50) NULL;

-- Add comments for documentation
COMMENT ON COLUMN students.blood_group IS 'Student blood group (A+, B+, O+, AB+, A-, B-, O-, AB-)';
COMMENT ON COLUMN students.allergies IS 'Known allergies (food, medication, environmental)';
COMMENT ON COLUMN students.medical_conditions IS 'Existing medical conditions or special needs';
COMMENT ON COLUMN students.emergency_contact_name IS 'Primary emergency contact person name';
COMMENT ON COLUMN students.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN students.emergency_contact_relationship IS 'Relationship to student (parent, guardian, etc.)';

-- Add index for emergency contact lookups
CREATE INDEX IF NOT EXISTS idx_students_emergency ON students(emergency_contact_phone);

SELECT 'Medical and emergency info columns added to students table successfully' AS status;
