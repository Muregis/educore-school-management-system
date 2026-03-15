-- Simple SQL Syntax Test for Phase 4 Performance Indexes
-- This can be run in any PostgreSQL client to verify syntax

-- Test 1: Basic index creation syntax
CREATE INDEX IF NOT EXISTS test_idx_students_school_created_at 
ON students (school_id, created_at);

-- Test 2: Composite index with multiple columns
CREATE INDEX IF NOT EXISTS test_idx_payments_school_status_date 
ON payments (school_id, status, payment_date);

-- Test 3: Index with different data types
CREATE INDEX IF NOT EXISTS test_idx_users_school_role_status 
ON users (school_id, role, status);

-- Test 4: Query to check existing indexes (syntax verification)
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('students', 'payments', 'users')
AND indexdef LIKE '%school_id%'
ORDER BY tablename, indexname;

-- Test 5: Simple aggregation query (syntax verification)
SELECT 
    'students' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools
FROM students;

-- Cleanup test indexes
DROP INDEX IF EXISTS test_idx_students_school_created_at;
DROP INDEX IF EXISTS test_idx_payments_school_status_date;
DROP INDEX IF EXISTS test_idx_users_school_role_status;
