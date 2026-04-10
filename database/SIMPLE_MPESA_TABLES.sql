-- Simplified M-Pesa Tables (without foreign key constraints that may cause issues)
-- Run this in Supabase SQL Editor if the previous version failed

DROP TABLE IF EXISTS mpesa_reconciliation_logs CASCADE;
DROP TABLE IF EXISTS mpesa_unmatched CASCADE;

-- Simple mpesa_unmatched table
CREATE TABLE mpesa_unmatched (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT,
  transaction_id VARCHAR(60) UNIQUE NOT NULL,
  amount NUMERIC(12,2),
  phone_number VARCHAR(40),
  bill_ref_number VARCHAR(60),
  raw_payload JSONB,
  matched_student_id BIGINT,
  matched_at TIMESTAMP WITH TIME ZONE,
  matched_by BIGINT,
  status VARCHAR(20) DEFAULT 'unmatched',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple mpesa_reconciliation_logs table
CREATE TABLE mpesa_reconciliation_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT,
  unmatched_id BIGINT,
  student_id BIGINT,
  payment_id BIGINT,
  action VARCHAR(20),
  performed_by BIGINT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_mpesa_unmatched_school ON mpesa_unmatched(school_id);
CREATE INDEX idx_mpesa_unmatched_transid ON mpesa_unmatched(transaction_id);
CREATE INDEX idx_recon_logs_school ON mpesa_reconciliation_logs(school_id);

-- Verify tables were created
SELECT 'mpesa_unmatched' as table_name, COUNT(*) as row_count FROM mpesa_unmatched
UNION ALL
SELECT 'mpesa_reconciliation_logs', COUNT(*) FROM mpesa_reconciliation_logs;
