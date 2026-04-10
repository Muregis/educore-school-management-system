-- =====================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Ensures tenant isolation for multi-tenant SaaS platform
-- All policies enforce school_id filtering based on JWT token

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

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Users can view their own profile and others in their school
CREATE POLICY users_tenant_policy ON users
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Users can insert/update their own school's users
CREATE POLICY users_school_policy ON users
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- STUDENTS TABLE POLICIES
-- =====================================================

-- Students can be viewed by users in their school
CREATE POLICY students_tenant_policy ON students
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Students can be managed by users in their school
CREATE POLICY students_school_policy ON students
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- TEACHERS TABLE POLICIES
-- =====================================================

-- Teachers can be viewed by users in their school
CREATE POLICY teachers_tenant_policy ON teachers
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Teachers can be managed by users in their school
CREATE POLICY teachers_school_policy ON teachers
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- PAYMENTS TABLE POLICIES
-- =====================================================

-- Payments can be viewed by users in their school
CREATE POLICY payments_tenant_policy ON payments
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Payments can be managed by users in their school
CREATE POLICY payments_school_policy ON payments
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- STUDENT LEDGER TABLE POLICIES
-- =====================================================

-- Ledger entries can be viewed by users in their school
CREATE POLICY student_ledger_tenant_policy ON student_ledger
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Ledger entries can be created by users in their school
CREATE POLICY student_ledger_school_policy ON student_ledger
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- ATTENDANCE TABLE POLICIES
-- =====================================================

-- Attendance can be viewed by users in their school
CREATE POLICY attendance_tenant_policy ON attendance
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Attendance can be recorded by users in their school
CREATE POLICY attendance_school_policy ON attendance
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- RESULTS TABLE POLICIES
-- =====================================================

-- Results can be viewed by users in their school
CREATE POLICY results_tenant_policy ON results
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Results can be created by users in their school
CREATE POLICY results_school_policy ON results
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- SUBJECTS TABLE POLICIES
-- =====================================================

-- Subjects can be viewed by users in their school
CREATE POLICY subjects_tenant_policy ON subjects
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Subjects can be managed by users in their school
CREATE POLICY subjects_school_policy ON subjects
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- FEE STRUCTURES TABLE POLICIES
-- =====================================================

-- Fee structures can be viewed by users in their school
CREATE POLICY fee_structures_tenant_policy ON fee_structures
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Fee structures can be managed by users in their school
CREATE POLICY fee_structures_school_policy ON fee_structures
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- FEE ITEMS TABLE POLICIES
-- =====================================================

-- Fee items can be viewed by users in their school
CREATE POLICY fee_items_tenant_policy ON fee_items
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Fee items can be managed by users in their school
CREATE POLICY fee_items_school_policy ON fee_items
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- CLASSES TABLE POLICIES
-- =====================================================

-- Classes can be viewed by users in their school
CREATE POLICY classes_tenant_policy ON classes
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Classes can be managed by users in their school
CREATE POLICY classes_school_policy ON classes
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- ACTIVITY LOGS TABLE POLICIES
-- =====================================================

-- Activity logs can be viewed by users in their school
CREATE POLICY activity_logs_tenant_policy ON activity_logs
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Activity logs can be created by users in their school
CREATE POLICY activity_logs_school_policy ON activity_logs
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- AUDIT LOGS TABLE POLICIES
-- =====================================================

-- Audit logs can be viewed by users in their school
CREATE POLICY audit_logs_tenant_policy ON audit_logs
    USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Audit logs can be created by users in their school
CREATE POLICY audit_logs_school_policy ON audit_logs
    WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- =====================================================
-- SECURITY FUNCTIONS
-- =====================================================

-- Function to reset tenant session (for connection pooling)
CREATE OR REPLACE FUNCTION reset_tenant_session()
RETURNS void AS $$
BEGIN
    -- Reset any session variables that might contain tenant info
    PERFORM set_config('app.current_school_id', '', false);
END;
$$ LANGUAGE plpgsql;

-- Function to get current school_id from JWT
CREATE OR REPLACE FUNCTION get_current_school_id()
RETURNS bigint AS $$
BEGIN
    RETURN (auth.jwt() ->> 'school_id')::bigint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes on school_id for all tenant tables
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_student_ledger_school_id ON student_ledger(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_results_school_id ON results(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_school_id ON fee_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_items_school_id ON fee_items(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_school_id ON activity_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(school_id);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- =====================================================

-- Composite indexes for common tenant + entity queries
CREATE INDEX IF NOT EXISTS idx_users_school_email ON users(school_id, email);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, class_name);
CREATE INDEX IF NOT EXISTS idx_payments_school_status ON payments(school_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_school_student ON student_ledger(school_id, student_id);

-- =====================================================
-- POLICY SUMMARY
-- =====================================================
-- All tables now have RLS enabled with tenant isolation
-- Users can only access data from their own school_id
-- JWT tokens must include school_id claim for proper isolation
-- Cross-tenant data access is prevented by RLS policies
