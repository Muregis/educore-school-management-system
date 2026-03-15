-- Migration: Create school_settings table for configuration management
-- Essential for school customization and onboarding

-- Create school_settings table (PostgreSQL syntax)
CREATE TABLE IF NOT EXISTS school_settings (
  setting_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NULL,
  setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string','number','boolean','json')),
  updated_by BIGINT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint for settings
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_setting ON school_settings(school_id, setting_key);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_settings_school ON school_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_settings_type ON school_settings(setting_type);

-- Add RLS policy for tenant isolation
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see settings from their own school
CREATE POLICY school_settings_school_isolation ON school_settings
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Add foreign key constraints (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
        ALTER TABLE school_settings 
        ADD CONSTRAINT fk_settings_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE school_settings 
        ADD CONSTRAINT fk_settings_updated_by 
        FOREIGN KEY (updated_by) REFERENCES users(user_id);
    END IF;
END $$;

-- Insert default settings for all existing schools
INSERT INTO school_settings (school_id, setting_key, setting_value, setting_type)
SELECT 
    school_id,
    setting_key,
    setting_value,
    setting_type
FROM (VALUES
    (1, 'academic_year', '2026', 'string'),
    (1, 'current_term', 'Term 2', 'string'),
    (1, 'school_logo', '', 'string'),
    (1, 'grading_scale', '{"EE":80,"ME":65,"AE":50,"BE":0}', 'json'),
    (1, 'auto_admission_numbers', 'true', 'boolean'),
    (1, 'fee_due_days', '30', 'number'),
    (1, 'receipt_prefix', 'REC', 'string'),
    (1, 'timezone', 'Africa/Nairobi', 'string'),
    (1, 'currency', 'KES', 'string'),
    (1, 'date_format', 'DD/MM/YYYY', 'string')
) AS defaults(school_id, setting_key, setting_value, setting_type)
WHERE NOT EXISTS (
    SELECT 1 FROM school_settings 
    WHERE school_settings.school_id = defaults.school_id 
    AND school_settings.setting_key = defaults.setting_key
);

COMMENT ON TABLE school_settings IS 'School-specific configuration settings for customization';
COMMENT ON COLUMN school_settings.setting_key IS 'Configuration key (e.g., academic_year, current_term)';
COMMENT ON COLUMN school_settings.setting_value IS 'Configuration value';
COMMENT ON COLUMN school_settings.setting_type IS 'Data type: string, number, boolean, or json';
