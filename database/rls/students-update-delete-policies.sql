-- Step 4: Add UPDATE and DELETE policies with complete security
-- UPDATE policy: Users can only update students in their school
CREATE POLICY "Users can update students from their school only" ON public.students
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- DELETE policy: Users can only delete students in their school
CREATE POLICY "Users can delete students from their school only" ON public.students
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify all policies on students table
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'students'
ORDER BY cmd, policyname;
