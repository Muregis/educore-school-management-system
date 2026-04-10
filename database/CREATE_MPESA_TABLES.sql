-- Create MPesa Reconciliation Tables for Production Supabase
-- Copy and paste this into Supabase SQL Editor to fix 500 errors on:
-- GET /api/mpesa/unmatched
-- GET /api/mpesa/reconciliation-logs

-- Table for unmatched M-Pesa payments (when billRef doesn't match any student)
CREATE TABLE IF NOT EXISTS mpesa_unmatched (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  transaction_id VARCHAR(60) NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL,
  phone_number VARCHAR(40),
  bill_ref_number VARCHAR(60),
  raw_payload JSONB,
  matched_student_id BIGINT REFERENCES students(student_id),
  matched_at TIMESTAMP WITH TIME ZONE,
  matched_by BIGINT REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_school ON mpesa_unmatched(school_id, status);
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_transid ON mpesa_unmatched(transaction_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_billref ON mpesa_unmatched(bill_ref_number);

-- Table for reconciliation audit trail
CREATE TABLE IF NOT EXISTS mpesa_reconciliation_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  unmatched_id BIGINT REFERENCES mpesa_unmatched(id),
  student_id BIGINT REFERENCES students(student_id),
  payment_id BIGINT REFERENCES payments(payment_id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('match', 'ignore', 'unignore')),
  performed_by BIGINT REFERENCES users(user_id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_recon_logs_school ON mpesa_reconciliation_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_recon_logs_created ON mpesa_reconciliation_logs(created_at);

-- Enable Row Level Security (if not already enabled)
ALTER TABLE mpesa_unmatched ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_reconciliation_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS policy to prevent cross-tenant access
CREATE POLICY "mpesa_unmatched_school_isolation" ON mpesa_unmatched
  FOR ALL USING (school_id IN (
    SELECT school_id FROM users WHERE user_id = auth.uid()
  ));

CREATE POLICY "mpesa_logs_school_isolation" ON mpesa_reconciliation_logs
  FOR ALL USING (school_id IN (
    SELECT school_id FROM users WHERE user_id = auth.uid()
  ));

-- Done! Tables are now ready for the API endpoints
