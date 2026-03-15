-- Step 6: Add RLS policies for payments table
-- Enable RLS if not already enabled
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view payments from their school only
CREATE POLICY "Users can view payments from their school only" ON public.payments
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- INSERT policy: Users can insert payments for their school only
CREATE POLICY "Users can insert payments for their school only" ON public.payments
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- UPDATE policy: Users can update payments in their school only
CREATE POLICY "Users can update payments from their school only" ON public.payments
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- DELETE policy: Users can delete payments from their school only
CREATE POLICY "Users can delete payments from their school only" ON public.payments
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Verify policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'payments'
ORDER BY cmd, policyname;
