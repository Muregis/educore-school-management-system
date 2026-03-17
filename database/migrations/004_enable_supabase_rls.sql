-- =====================================================
-- MIGRATION 004: ENABLE SUPABASE ROW LEVEL SECURITY
-- =====================================================
-- This migration enables RLS on all tenant tables and creates
-- policies to ensure proper data isolation between schools

-- Run this migration after creating the database schema
-- and importing existing data into Supabase

BEGIN;

-- Enable RLS on all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Insert migration record
INSERT INTO migrations (migration_id, description, executed_at, status)
VALUES (
    '004_enable_supabase_rls',
    'Enable Supabase Row Level Security for tenant isolation',
    NOW(),
    'completed'
);

COMMIT;

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
-- 1. After this migration, run the supabase-tenant-policies.sql script
-- 2. Ensure all JWT tokens include school_id claim
-- 3. Test tenant isolation by trying to access cross-tenant data
-- 4. Monitor performance and add composite indexes as needed
