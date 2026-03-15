-- Phase 4: Database Performance Safety Analysis
-- Verify tenant-aware indexing for multi-tenant SaaS scalability

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

-- Analyze missing composite indexes for optimal tenant performance
-- Check for high-traffic tenant queries that need better indexing

-- Students table - Verify tenant-aware indexes
SELECT 
    'students' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(created_at) as latest_record
FROM students;

-- Payments table - Verify tenant-aware indexes  
SELECT 
    'payments' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(payment_date) as latest_payment
FROM payments;

-- Results table - Verify tenant-aware indexes
SELECT 
    'results' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(created_at) as latest_result
FROM results;

-- Activity logs - Verify tenant-aware indexes
SELECT 
    'activity_logs' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT school_id) as unique_schools,
    MAX(created_at) as latest_log
FROM activity_logs;

-- Check query performance for tenant-filtered queries
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM students 
WHERE school_id = 1 AND is_deleted = false 
ORDER BY class_name, first_name 
LIMIT 10;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM payments 
WHERE school_id = 1 AND status = 'paid' 
ORDER BY payment_date DESC 
LIMIT 10;
