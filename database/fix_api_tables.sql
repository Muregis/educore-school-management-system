-- Fix subjects table to match code expectations
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS class_levels VARCHAR(255) DEFAULT NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS max_marks INTEGER DEFAULT 100;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS pass_marks INTEGER DEFAULT 40;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- M-Pesa reconciliation tables
CREATE TABLE IF NOT EXISTS mpesa_reconciliation_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  action VARCHAR(100),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mpesa_unmatched (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  transaction_id VARCHAR(100),
  amount DECIMAL(12,2),
  phone VARCHAR(40),
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_school ON mpesa_unmatched(school_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_status ON mpesa_unmatched(status);