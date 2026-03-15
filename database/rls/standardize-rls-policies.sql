-- Migration: Standardize RLS patterns to use JWT-based approach
-- Replace inconsistent current_setting patterns with auth.jwt() patterns

-- OLD: audit_logs used current_setting('app.current_school_id')::BIGINT
-- NEW: Use consistent JWT-based pattern like other tables

-- Drop old inconsistent policy
DROP POLICY IF EXISTS audit_logs_school_isolation ON audit_logs;

-- Create consistent JWT-based policies for audit_logs
CREATE POLICY "Users can view audit logs from their school only" ON public.activity_logs
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- System can insert activity logs (for internal logging)
CREATE POLICY "System can insert activity logs" ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

-- No direct UPDATE/DELETE for activity logs (audit trail)
CREATE POLICY "No updates to activity logs" ON public.activity_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to activity logs" ON public.activity_logs
  FOR DELETE
  USING (false);

-- Standardize student_ledger RLS pattern
-- Drop old inconsistent policy
DROP POLICY IF EXISTS student_ledger_school_isolation ON student_ledger;

-- Create consistent JWT-based policies for student_ledger
CREATE POLICY "Users can view ledger entries from their school only" ON public.student_ledger
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Users can insert ledger entries for their school only
CREATE POLICY "Users can insert ledger entries for their school only" ON public.student_ledger
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Users can update ledger entries in their school only
CREATE POLICY "Users can update ledger entries from their school only" ON public.student_ledger
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Users can delete ledger entries from their school only
CREATE POLICY "Users can delete ledger entries from their school only" ON public.student_ledger
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify standardized policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename IN ('activity_logs', 'student_ledger')
ORDER BY tablename, cmd, policyname;
