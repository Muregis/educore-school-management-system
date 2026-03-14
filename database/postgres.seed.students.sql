-- EduCore Postgres/Supabase seed (Step 3)
-- Seeds ONLY the `students` table (requires `schools`, `classes`).

INSERT INTO public.students
  (student_id, school_id, class_id, class_name, admission_number, first_name, last_name, gender, date_of_birth, parent_name, parent_phone, admission_date, status)
VALUES
  (1, 1, 3, 'Grade 7', 'ADM-2020-001', 'Amara', 'Osei',  'female', '2012-03-14', 'Mr. Kofi Osei',   '0712345678', '2020-01-10', 'active'),
  (2, 1, 4, 'Grade 8', 'ADM-2019-002', 'Brian', 'Kamau', 'male',   '2011-07-22', 'Mrs. Mary Kamau', '0723456789', '2019-01-15', 'active'),
  (3, 1, 2, 'Grade 6', 'ADM-2021-003', 'Chloe', 'Mutua', 'female', '2013-01-05', 'Mr. Peter Mutua', '0734567890', '2021-01-12', 'active'),
  (4, 1, 1, 'Grade 5', 'ADM-2022-004', 'Kevin', 'Osei',  'male',   '2014-06-10', 'Mr. Kofi Osei',   '0712345678', '2022-01-10', 'active')
ON CONFLICT (student_id) DO NOTHING;

-- Keep identity sequence in sync if we inserted explicit IDs.
SELECT setval(
  pg_get_serial_sequence('public.students', 'student_id'),
  COALESCE((SELECT MAX(student_id) FROM public.students), 1)
);

