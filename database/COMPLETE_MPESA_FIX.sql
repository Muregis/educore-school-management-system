-- COMPLETE MPESA TABLES FIX
-- Run this entire script in Supabase SQL Editor

-- Step 1: Check if tables exist
SELECT 'Checking existing tables...' as status;
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN ('mpesa_unmatched', 'mpesa_reconciliation_logs')
  AND schemaname = 'public';

-- Step 2: Drop tables if they exist (to ensure clean creation)
DROP TABLE IF EXISTS mpesa_reconciliation_logs CASCADE;
DROP TABLE IF EXISTS mpesa_unmatched CASCADE;

-- Step 3: Create mpesa_unmatched table
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

-- Step 4: Create mpesa_reconciliation_logs table
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

-- Step 5: Create indexes for performance
CREATE INDEX idx_mpesa_unmatched_school ON mpesa_unmatched(school_id);
CREATE INDEX idx_mpesa_unmatched_transid ON mpesa_unmatched(transaction_id);
CREATE INDEX idx_recon_logs_school ON mpesa_reconciliation_logs(school_id);

-- Step 6: Verify tables were created successfully
SELECT 'Tables created successfully!' as status;
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN ('mpesa_unmatched', 'mpesa_reconciliation_logs')
  AND schemaname = 'public';

-- Step 7: Test a simple query on each table
SELECT 'Testing mpesa_unmatched...' as test, COUNT(*) as row_count FROM mpesa_unmatched;
SELECT 'Testing mpesa_reconciliation_logs...' as test, COUNT(*) as row_count FROM mpesa_reconciliation_logs;