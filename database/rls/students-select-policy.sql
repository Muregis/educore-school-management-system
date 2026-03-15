-- Step 2: Enable RLS on students table and add SELECT policy
-- This ensures users can only see students from their own school

-- First, enable RLS on the table
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Add SELECT policy using the custom school_id claim from JWT
-- auth.jwt() ->> 'school_id' extracts the school_id from our custom JWT
CREATE POLICY "Users can view students from their school only" ON public.students
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Note: We cast to bigint because our school_id column is BIGINT type
