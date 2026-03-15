-- Drop existing policy and create a simpler one for testing
DROP POLICY IF EXISTS "Users can view students from their school only" ON public.students;

-- Create a simple policy that allows all authenticated users
-- We'll refine this once we confirm basic RLS works
CREATE POLICY "Enable all authenticated users" ON public.students
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Check if policy was created
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'students';
