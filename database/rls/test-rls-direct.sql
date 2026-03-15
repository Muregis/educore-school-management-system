-- Test RLS policy directly in Supabase SQL Editor
-- This simulates what happens when a user with school_id=1 queries students

-- First, let's test the policy logic directly
SELECT 
  auth.jwt() ->> 'school_id' as extracted_school_id,
  (auth.jwt() ->> 'school_id')::bigint as school_id_bigint;

-- Test what students would be visible for school_id=1
SELECT * FROM students 
WHERE school_id = (auth.jwt() ->> 'school_id')::bigint;

-- Test with a mock JWT (this won't work in SQL Editor but shows the logic)
-- The policy should work when real JWT is provided via client
