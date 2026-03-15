-- Phase 4: Fixed Performance Indexes for Multi-Tenant Scale
-- All column names verified against actual table schemas

-- Students table - Critical for tenant performance
CREATE INDEX IF NOT EXISTS idx_students_school_created_at 
ON public.students (school_id, created_at);

CREATE INDEX IF NOT EXISTS idx_students_school_status_created 
ON public.students (school_id, status, created_at);

-- Payments table - Critical for financial queries
CREATE INDEX IF NOT EXISTS idx_payments_school_status_date 
ON public.payments (school_id, status, payment_date);

CREATE INDEX IF NOT EXISTS idx_payments_school_student_date 
ON public.payments (school_id, student_id, payment_date);

-- Users table - Critical for authentication queries
CREATE INDEX IF NOT EXISTS idx_users_school_status_created 
ON public.users (school_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_users_school_role_status 
ON public.users (school_id, role, status);

-- Attendance table - Time-based tenant queries
CREATE INDEX IF NOT EXISTS idx_attendance_school_date_status 
ON public.attendance (school_id, attendance_date, status);

-- Results table - Academic performance queries
CREATE INDEX IF NOT EXISTS idx_results_school_term_created 
ON public.results (school_id, term, created_at);

CREATE INDEX IF NOT EXISTS idx_results_school_student_term 
ON public.results (school_id, student_id, term);

-- Activity logs - Audit trail performance (uses created_at)
CREATE INDEX IF NOT EXISTS idx_activity_logs_school_action_created 
ON public.activity_logs (school_id, action, created_at);

-- Audit logs - Security monitoring performance (uses timestamp)
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_action_timestamp 
ON public.audit_logs (school_id, action, timestamp);

-- Student ledger - Financial tracking performance (uses created_at, transaction_type)
CREATE INDEX IF NOT EXISTS idx_student_ledger_school_type_created 
ON public.student_ledger (school_id, transaction_type, created_at);

-- Verify all tenant-aware indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('students', 'payments', 'users', 'attendance', 'results', 'activity_logs', 'audit_logs', 'student_ledger')
AND indexdef LIKE '%school_id%'
ORDER BY tablename, indexname;
