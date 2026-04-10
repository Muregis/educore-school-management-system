-- Add subscription plan column to schools
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'starter' 
CHECK (plan IN ('starter', 'standard', 'premium'));

-- Set default plan for existing schools (starter)
UPDATE schools SET plan = 'starter' WHERE plan IS NULL;

SELECT 'Added plan column to schools table' AS status;