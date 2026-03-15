-- Simple check for RLS policies on students table
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'students';

-- Check student data
SELECT COUNT(*) as total_students, 
       COUNT(CASE WHEN school_id = 1 THEN 1 END) as school1_students,
       COUNT(CASE WHEN school_id = 2 THEN 1 END) as school2_students
FROM students;
