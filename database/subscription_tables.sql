-- Add subscription fields to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'starter' 
CHECK (plan IN ('starter', 'standard', 'premium')),
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS student_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_fee DECIMAL(10,2) DEFAULT 0;

-- Update existing schools to starter
UPDATE schools SET plan = 'starter' WHERE plan IS NULL;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(school_id),
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('starter', 'standard', 'premium')),
  student_count INTEGER NOT NULL,
  monthly_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  payment_reference VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_school 
ON subscriptions(school_id, created_at);

SELECT 'Created subscription tables successfully' AS status;