-- Fixed RLS Security Script - All SQL syntax errors resolved

-- Step 1: Create session reset function
CREATE OR REPLACE FUNCTION reset_tenant_session()
RETURNS void AS $$
BEGIN
    -- Reset any tenant-specific session variables
    PERFORM set_config('app.current_school_id', NULL, false);
    PERFORM set_config('app.current_user_id', NULL, false);
    PERFORM set_config('app.current_role', NULL, false);
END;
$$ LANGUAGE plpgsql;

-- Step 2: Enable RLS and create policies for results table
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view results from their school only" ON public.results;
DROP POLICY IF EXISTS "Users can insert results for their school only" ON public.results;
DROP POLICY IF EXISTS "Users can update results from their school only" ON public.results;
DROP POLICY IF EXISTS "Users can delete results from their school only" ON public.results;

-- Create comprehensive RLS policies for results
CREATE POLICY "Users can view results from their school only" ON public.results
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert results for their school only" ON public.results
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update results from their school only" ON public.results
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can delete results from their school only" ON public.results
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Step 3: Standardize activity_logs RLS pattern (uses created_at column)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop old inconsistent policies
DROP POLICY IF EXISTS "Users can view activity logs from their school only" ON public.activity_logs;
DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "No updates to activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "No deletes to activity logs" ON public.activity_logs;

-- Create consistent JWT-based policies
CREATE POLICY "Users can view activity logs from their school only" ON public.activity_logs
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "System can insert activity logs" ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "No updates to activity logs" ON public.activity_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to activity logs" ON public.activity_logs
  FOR DELETE
  USING (false);

-- Step 4: Standardize audit_logs RLS pattern (uses timestamp column)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop old inconsistent policy
DROP POLICY IF EXISTS audit_logs_school_isolation ON public.audit_logs;

-- Create consistent JWT-based policies
CREATE POLICY "Users can view audit logs from their school only" ON public.audit_logs
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "No updates to audit logs" ON public.audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to audit logs" ON public.audit_logs
  FOR DELETE
  USING (false);

-- Step 5: Standardize student_ledger RLS pattern
ALTER TABLE public.student_ledger ENABLE ROW LEVEL SECURITY;

-- Drop old inconsistent policies
DROP POLICY IF EXISTS "Users can view ledger entries from their school only" ON public.student_ledger;
DROP POLICY IF EXISTS "Users can insert ledger entries for their school only" ON public.student_ledger;
DROP POLICY IF EXISTS "Users can update ledger entries from their school only" ON public.student_ledger;
DROP POLICY IF EXISTS "Users can delete ledger entries from their school only" ON public.student_ledger;

-- Create consistent JWT-based policies
CREATE POLICY "Users can view ledger entries from their school only" ON public.student_ledger
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert ledger entries for their school only" ON public.student_ledger
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update ledger entries from their school only" ON public.student_ledger
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can delete ledger entries from their school only" ON public.student_ledger
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Step 6: Add performance indexes with correct column names
CREATE INDEX IF NOT EXISTS idx_results_school_term 
ON public.results (school_id, term);

CREATE INDEX IF NOT EXISTS idx_results_school_student_term
ON public.results (school_id, student_id, term);

-- Fixed: activity_logs uses created_at, not timestamp
CREATE INDEX IF NOT EXISTS idx_activity_logs_school_created_at 
ON public.activity_logs (school_id, created_at);

-- audit_logs uses timestamp column
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_timestamp 
ON public.audit_logs (school_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_student_ledger_school_student 
ON public.student_ledger (school_id, student_id);

-- Step 7: Verification
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%auth.jwt()%' THEN 'JWT-based ✓'
        WHEN qual LIKE '%current_setting%' THEN 'Session-based ⚠️'
        ELSE 'Unknown ❌'
    END as pattern_type
FROM pg_policies 
WHERE tablename IN ('students', 'payments', 'users', 'attendance', 'fee_structures', 
                   'classes', 'activity_logs', 'audit_logs', 'results', 'student_ledger')
ORDER BY tablename, cmd;

-- Check for any remaining inconsistent patterns
SELECT 
    'INCONSISTENT PATTERN FOUND' as warning,
    tablename,
    policyname,
    qual
FROM pg_policies 
WHERE qual LIKE '%current_setting%'
AND tablename IN ('students', 'payments', 'users', 'attendance', 'fee_structures', 
                 'classes', 'activity_logs', 'audit_logs', 'results', 'student_ledger');
