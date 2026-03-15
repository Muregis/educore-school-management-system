-- Step 3: Add INSERT policy with WITH CHECK for security
-- This ensures users can only insert students for their own school

CREATE POLICY "Users can insert students for their school only" ON public.students
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify all policies on students table
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'students'
ORDER BY cmd, policyname;
