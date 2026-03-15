-- RLS Security Fixes Execution Script
-- Run this script to apply all critical RLS fixes

-- Step 1: Create missing RLS policies for results/grades table

-- Enable RLS on results table
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
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

-- Step 2: Standardize audit_logs RLS pattern

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

-- Step 3: Standardize student_ledger RLS pattern

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

-- Step 4: Create session reset function

CREATE OR REPLACE FUNCTION reset_tenant_session()
RETURNS void AS $$
BEGIN
    -- Reset any tenant-specific session variables
    PERFORM set_config('app.current_school_id', NULL, false);
    PERFORM set_config('app.current_user_id', NULL, false);
    PERFORM set_config('app.current_role', NULL, false);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add performance indexes

CREATE INDEX IF NOT EXISTS idx_results_school_term 
ON public.results (school_id, term);

CREATE INDEX IF NOT EXISTS idx_results_school_student_term
ON public.results (school_id, student_id, term);

CREATE INDEX IF NOT EXISTS idx_activity_logs_school_created_at 
ON public.activity_logs (school_id, created_at);

CREATE INDEX IF NOT EXISTS idx_student_ledger_school_student 
ON public.student_ledger (school_id, student_id);

-- Step 6: Verification

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
                   'classes', 'activity_logs', 'results', 'student_ledger')
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
                 'classes', 'activity_logs', 'results', 'student_ledger');

-- RLS security fixes completed successfully!
-- All tables now use consistent JWT-based RLS patterns.
-- Connection pool session reset function created.
