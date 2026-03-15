-- Step 9: Add RLS policies for fee_structures table
-- Enable RLS if not already enabled
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

-- Users can view fee structures from their school only
CREATE POLICY "Users can view fee structures from their school only" ON public.fee_structures
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Admin/finance can insert fee structures for their school only
CREATE POLICY "Admin/finance can insert fee structures for their school only" ON public.fee_structures
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Admin/finance can update fee structures in their school only
CREATE POLICY "Admin/finance can update fee structures from their school only" ON public.fee_structures
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Admin can delete fee structures from their school only
CREATE POLICY "Admin can delete fee structures from their school only" ON public.fee_structures
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'fee_structures'
ORDER BY cmd, policyname;
