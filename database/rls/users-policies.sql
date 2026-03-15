-- Step 6: Add RLS policies for users table
-- Enable RLS if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view users from their school only
CREATE POLICY "Users can view users from their school only" ON public.users
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- INSERT policy: Users can insert users for their school only
CREATE POLICY "Users can insert users for their school only" ON public.users
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- UPDATE policy: Users can update users in their school only
CREATE POLICY "Users can update users from their school only" ON public.users
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- DELETE policy: Users can delete users from their school only
CREATE POLICY "Users can delete users from their school only" ON public.users
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;
