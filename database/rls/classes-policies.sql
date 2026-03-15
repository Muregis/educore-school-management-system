-- Step 6: Add RLS policies for classes table
-- Enable RLS if not already enabled
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view classes from their school only
CREATE POLICY "Users can view classes from their school only" ON public.classes
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- INSERT policy: Users can insert classes for their school only
CREATE POLICY "Users can insert classes for their school only" ON public.classes
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- UPDATE policy: Users can update classes in their school only
CREATE POLICY "Users can update classes from their school only" ON public.classes
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- DELETE policy: Users can delete classes from their school only
CREATE POLICY "Users can delete classes from their school only" ON public.classes
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'classes'
ORDER BY cmd, policyname;
