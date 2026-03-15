-- Migration: Fix missing RLS policies for results/grades table
-- This is critical for tenant isolation

-- Enable RLS on results table
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view results from their school only
CREATE POLICY "Users can view results from their school only" ON public.results
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- INSERT policy: Users can insert results for their school only
CREATE POLICY "Users can insert results for their school only" ON public.results
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- UPDATE policy: Users can update results in their school only
CREATE POLICY "Users can update results from their school only" ON public.results
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- DELETE policy: Users can delete results from their school only
CREATE POLICY "Users can delete results from their school only" ON public.results
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'results'
ORDER BY cmd, policyname;

COMMENT ON TABLE public.results IS 'Student grades/exam results with RLS tenant isolation';
COMMENT ON COLUMN public.results.school_id IS 'Tenant identifier for RLS isolation';
