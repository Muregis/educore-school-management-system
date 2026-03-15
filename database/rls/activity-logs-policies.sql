-- Step 8: Add RLS policies for activity_logs table
-- Enable RLS if not already enabled
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs from their school only
CREATE POLICY "Users can view activity logs from their school only" ON public.activity_logs
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

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'activity_logs'
ORDER BY cmd, policyname;
