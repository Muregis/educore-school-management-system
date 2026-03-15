-- Step 6: Add RLS policies for attendance table
-- Enable RLS if not already enabled
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view attendance from their school only
CREATE POLICY "Users can view attendance from their school only" ON public.attendance
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- INSERT policy: Users can insert attendance for their school only
CREATE POLICY "Users can insert attendance for their school only" ON public.attendance
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- UPDATE policy: Users can update attendance in their school only
CREATE POLICY "Users can update attendance from their school only" ON public.attendance
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- DELETE policy: Users can delete attendance from their school only
CREATE POLICY "Users can delete attendance from their school only" ON public.attendance
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'attendance'
ORDER BY cmd, policyname;
