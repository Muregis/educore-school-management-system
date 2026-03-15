-- Connection Pool Session Reset Middleware
-- Prevents tenant context contamination between requests

-- Create a function to reset session variables
CREATE OR REPLACE FUNCTION reset_tenant_session()
RETURNS void AS $$
BEGIN
    -- Reset any tenant-specific session variables
    PERFORM set_config('app.current_school_id', NULL, false);
    -- Add any other session variables that need resetting
    PERFORM set_config('app.current_user_id', NULL, false);
    PERFORM set_config('app.current_role', NULL, false);
END;
$$ LANGUAGE plpgsql;

-- Create index for better RLS performance
CREATE INDEX IF NOT EXISTS idx_results_school_term 
ON public.results (school_id, term);

CREATE INDEX IF NOT EXISTS idx_results_school_student_term
ON public.results (school_id, student_id, term);

-- Add missing indexes for activity_logs and student_ledger
CREATE INDEX IF NOT EXISTS idx_activity_logs_school_timestamp 
ON public.activity_logs (school_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_student_ledger_school_student 
ON public.student_ledger (school_id, student_id);

-- Verify all RLS policies are using consistent JWT pattern
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('students', 'payments', 'users', 'attendance', 'fee_structures', 
                   'classes', 'activity_logs', 'results', 'student_ledger')
ORDER BY tablename, cmd;

-- Check for any remaining current_setting patterns
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE qual LIKE '%current_setting%';

COMMENT ON FUNCTION reset_tenant_session() IS 'Resets tenant session variables to prevent connection pool contamination';
