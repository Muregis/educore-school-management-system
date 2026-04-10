-- FIX MISSING TABLES FOR EXAMS AND MPESA FUNCTIONALITY
-- Run this in Supabase SQL Editor to fix the failing endpoints

-- Fix exams table schema to match backend expectations
DROP TABLE IF EXISTS exam_schedules CASCADE;
DROP TABLE IF EXISTS exams CASCADE;

CREATE TABLE IF NOT EXISTS exams (
  exam_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT,
  exam_name VARCHAR(100) NOT NULL,
  exam_type VARCHAR(40) DEFAULT 'internal',
  term VARCHAR(40),
  academic_year INTEGER,
  start_date DATE,
  end_date DATE,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exam schedules table (for scheduling exams per subject/class)
CREATE TABLE IF NOT EXISTS exam_schedules (
  schedule_id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT REFERENCES exams(exam_id),
  subject_id BIGINT,
  class_name VARCHAR(80),
  exam_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue VARCHAR(100),
  max_marks INTEGER DEFAULT 100,
  instructions TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MPesa reconciliation tables
CREATE TABLE IF NOT EXISTS mpesa_unmatched (
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

CREATE TABLE IF NOT EXISTS mpesa_reconciliation_logs (
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
CREATE INDEX IF NOT EXISTS idx_exams_school ON exams(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_date ON exam_schedules(exam_date);
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_school ON mpesa_unmatched(school_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_transid ON mpesa_unmatched(transaction_id);
CREATE INDEX IF NOT EXISTS idx_recon_logs_school ON mpesa_reconciliation_logs(school_id);

-- Verify tables were created
SELECT 'Tables created successfully!' as status;
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN ('exams', 'exam_schedules', 'mpesa_unmatched', 'mpesa_reconciliation_logs')
  AND schemaname = 'public';