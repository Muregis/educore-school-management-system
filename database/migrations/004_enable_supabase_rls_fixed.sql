-- =====================================================
-- MIGRATION 004: ENABLE SUPABASE ROW LEVEL SECURITY (FIXED)
-- =====================================================
-- This migration enables RLS on all tenant tables and creates
-- policies to ensure proper data isolation between schools

-- Run this migration after creating the database schema
-- and importing existing data into Supabase

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

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
-- 1. After this migration, run the supabase-tenant-policies.sql script
-- 2. Ensure all JWT tokens include school_id claim
-- 3. Test tenant isolation by trying to access cross-tenant data
-- 4. Monitor performance and add indexes as needed

-- =====================================================
-- INDEX CREATION (run separately, not in transaction)
-- =====================================================
-- Run these commands individually after the migration:

-- CREATE INDEX CONCURRENTLY idx_users_school_id ON users(school_id);
-- CREATE INDEX CONCURRENTLY idx_students_school_id ON students(school_id);
-- CREATE INDEX CONCURRENTLY idx_teachers_school_id ON teachers(school_id);
-- CREATE INDEX CONCURRENTLY idx_payments_school_id ON payments(school_id);
-- CREATE INDEX CONCURRENTLY idx_student_ledger_school_id ON student_ledger(school_id);
-- CREATE INDEX CONCURRENTLY idx_attendance_school_id ON attendance(school_id);
-- CREATE INDEX CONCURRENTLY idx_results_school_id ON results(school_id);
-- CREATE INDEX CONCURRENTLY idx_subjects_school_id ON subjects(school_id);
-- CREATE INDEX CONCURRENTLY idx_fee_structures_school_id ON fee_structures(school_id);
-- CREATE INDEX CONCURRENTLY idx_fee_items_school_id ON fee_items(school_id);
-- CREATE INDEX CONCURRENTLY idx_classes_school_id ON classes(school_id);
-- CREATE INDEX CONCURRENTLY idx_activity_logs_school_id ON activity_logs(school_id);
-- CREATE INDEX CONCURRENTLY idx_audit_logs_school_id ON audit_logs(school_id);

-- Composite indexes for common queries:
-- CREATE INDEX CONCURRENTLY idx_users_school_email ON users(school_id, email);
-- CREATE INDEX CONCURRENTLY idx_students_school_class ON students(school_id, class_name);
-- CREATE INDEX CONCURRENTLY idx_payments_school_status ON payments(school_id, status);
-- CREATE INDEX CONCURRENTLY idx_attendance_school_date ON attendance(school_id, attendance_date);
-- CREATE INDEX CONCURRENTLY idx_ledger_school_student ON student_ledger(school_id, student_id);
