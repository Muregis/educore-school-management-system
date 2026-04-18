-- Add photo_url field to students table for student ID photos
ALTER TABLE students
ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;

-- Add index for photo_url if needed (optional)
CREATE INDEX IF NOT EXISTS idx_students_photo_url
ON students(photo_url)
WHERE photo_url IS NOT NULL;

SELECT 'Added photo_url column to students table' AS status;