-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `teachers` table (requires `schools`, `users`).

INSERT INTO public.teachers
  (teacher_id, school_id, user_id, staff_number, national_id, first_name, last_name, email, phone, hire_date, department, qualification, status)
VALUES
  (1, 1, 2,    'T-0001', '12345678', 'Grace', 'Akinyi', 'teacher@greenfield.ac.ke',    '+254711222333', '2024-01-15', 'Sciences',  'B.Ed Mathematics', 'active'),
  (2, 1, NULL, 'T-0002', '23456789', 'James', 'Mwangi', 'j.mwangi@greenfield.ac.ke',  '+254722333444', '2023-09-01', 'Languages', 'BA Education',      'active')
ON CONFLICT (teacher_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.teachers', 'teacher_id'),
  COALESCE((SELECT MAX(teacher_id) FROM public.teachers), 1)
);

