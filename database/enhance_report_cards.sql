-- Enhance report_cards with school branding and custom fields
ALTER TABLE report_cards 
ADD COLUMN IF NOT EXISTS logo_url TEXT NULL,
ADD COLUMN IF NOT EXISTS school_name VARCHAR(160) NULL,
ADD COLUMN IF NOT EXISTS school_address TEXT NULL,
ADD COLUMN IF NOT EXISTS school_phone VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS school_email TEXT NULL,
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS head_teacher_name VARCHAR(160) NULL,
ADD COLUMN IF NOT EXISTS custom_remarks TEXT NULL,
ADD COLUMN IF NOT EXISTS exam_name VARCHAR(160) NULL,
ADD COLUMN IF NOT EXISTS grading_system VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS watermark_url TEXT NULL,
ADD COLUMN IF NOT EXISTS signature_url TEXT NULL,
ADD COLUMN IF NOT EXISTS background_color VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS text_color VARCHAR(20) NULL;

-- Add index for generated reports
CREATE INDEX IF NOT EXISTS idx_report_cards_generated 
ON report_cards(school_id, academic_year, term, is_published);

-- Add photo upload fields for student IDs
ALTER TABLE report_cards 
ADD COLUMN IF NOT EXISTS student_photo_url TEXT NULL,
ADD COLUMN IF NOT EXISTS school_stamp_url TEXT NULL,
ADD COLUMN IF NOT EXISTS stamp_position VARCHAR(20) DEFAULT 'bottom-right';

SELECT 'Enhanced report_cards table with branding and photo fields' AS status;