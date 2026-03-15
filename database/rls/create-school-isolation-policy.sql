-- Replace the simple policy with proper school isolation
DROP POLICY IF EXISTS "Enable all authenticated users" ON public.students;

-- Create the proper school isolation policy
CREATE POLICY "Users can view students from their school only" ON public.students
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify the policy was created correctly
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'students';
