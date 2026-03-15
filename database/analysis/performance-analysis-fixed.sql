-- Phase 4: Database Performance Analysis - Fixed SQL
-- All queries verified against existing table structures

-- Check existing indexes on critical tables
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('students', 'payments', 'users', 'attendance', 'results', 'activity_logs', 'audit_logs', 'student_ledger')
AND indexdef LIKE '%school_id%'
ORDER BY tablename, indexname;

-- Analyze table sizes and tenant distribution
-- Students table analysis
SELECT 
    'students' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(created_at) as latest_record
FROM students;

-- Payments table analysis
SELECT 
    'payments' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(payment_date) as latest_payment
FROM payments;

-- Users table analysis
SELECT 
    'users' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(created_at) as latest_user
FROM users;

-- Results table analysis
SELECT 
    'results' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(created_at) as latest_result
FROM results;

-- Activity logs analysis
SELECT 
    'activity_logs' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(created_at) as latest_log
FROM activity_logs;

-- Check for missing critical indexes
SELECT 
    'Missing school_id + created_at index' as recommendation,
    tablename
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('students', 'payments', 'users', 'attendance', 'results', 'activity_logs')
AND tablename NOT IN (
    SELECT DISTINCT tablename 
    FROM pg_indexes 
    WHERE indexdef LIKE '%school_id%' 
    AND indexdef LIKE '%created_at%'
);
