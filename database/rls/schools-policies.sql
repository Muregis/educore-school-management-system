-- Step 7: Add RLS policies for schools table
-- Enable RLS if not already enabled
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Schools table should be read-only for authenticated users (admin-only for writes)
CREATE POLICY "Users can view schools" ON public.schools
  FOR SELECT
  USING (true); -- Allow all authenticated users to view schools list

-- Only system admin can create/update schools (restrictive policy)
CREATE POLICY "System admin can manage schools" ON public.schools
  FOR ALL
  USING (false); -- No direct INSERT/UPDATE/DELETE through RLS

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'schools'
ORDER BY cmd, policyname;
