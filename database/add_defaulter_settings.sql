-- Add defaulter blocking settings
ALTER TABLE school_settings 
ADD COLUMN IF NOT EXISTS setting_key VARCHAR(100) PRIMARY KEY,
ADD COLUMN IF NOT EXISTS setting_value TEXT;

INSERT INTO school_settings (school_id, setting_key, setting_value) VALUES
(1, 'block_defaulters', 'true'),
(1, 'defaulter_grace_days', '7')
ON CONFLICT (school_id, setting_key) DO NOTHING;

SELECT 'Added defaulter settings' AS status;