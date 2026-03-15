-- Debug version with more robust policy
DROP POLICY IF EXISTS "Users can view students from their school only" ON public.students;

-- Try different extraction methods
CREATE POLICY "Users can view students from their school only" ON public.students
  FOR SELECT
  USING (
    school_id = (
      CASE 
        WHEN auth.jwt() IS NOT NULL 
        THEN (auth.jwt() ->> 'school_id')::bigint 
        ELSE NULL 
      END
    )
  );

-- Also test the extraction directly
SELECT 
  auth.jwt() as full_jwt,
  auth.jwt() ->> 'school_id' as school_id_extracted,
  (auth.jwt() ->> 'school_id')::bigint as school_id_bigint;

-- Check policy
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'students';
