-- Check if RLS is enabled and policies exist (corrected for PostgreSQL)
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'students';

-- Test basic query to see student data
SELECT COUNT(*) as total_students, 
       COUNT(CASE WHEN school_id = 1 THEN 1 END) as school1_students,
       COUNT(CASE WHEN school_id = 2 THEN 1 END) as school2_students
FROM students;

-- Check if our specific policy exists
SELECT polname, polcmd, polpermissive, polroles
FROM pg_policy 
WHERE polrelid = 'public.students'::regclass;
