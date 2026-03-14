-- EduCore Postgres/Supabase seed (Step 3)
-- Seeds ONLY the `users` table (requires `schools`).

INSERT INTO public.users
  (user_id, school_id, student_id, full_name, email, phone, password_hash, role, status)
VALUES
  (1, 1, NULL, 'Mrs. Wanjiku',   'admin@greenfield.ac.ke',   '+254712345678', 'admin123',     'admin',     'active'),
  (2, 1, NULL, 'Grace Akinyi',   'teacher@greenfield.ac.ke', '+254711222333', 'teacher123',   'teacher',   'active'),
  (3, 1, NULL, 'Peter Maina',    'finance@greenfield.ac.ke', '+254733444555', 'finance123',   'finance',   'active'),
  (12,1, NULL, 'Jane Otieno',    'hr@greenfield.ac.ke',      '+254755666777', 'hr123',        'hr',        'active'),
  (13,1, NULL, 'Mary Njoroge',   'librarian@greenfield.ac.ke','+254766777888','librarian123', 'librarian', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.users
  (user_id, school_id, student_id, full_name, email, password_hash, role, status)
VALUES
  (4,  1, 1, 'Mr. Kofi Osei (Parent)',   'adm-2020-001.parent@portal',  'parent123',  'parent',  'active'),
  (5,  1, 1, 'Amara Osei (Student)',     'adm-2020-001.student@portal', 'student123', 'student', 'active'),
  (6,  1, 4, 'Mr. Kofi Osei (Parent)',   'adm-2022-004.parent@portal',  'parent123',  'parent',  'active'),
  (7,  1, 4, 'Kevin Osei (Student)',     'adm-2022-004.student@portal', 'student123', 'student', 'active'),
  (8,  1, 2, 'Mrs. Mary Kamau (Parent)', 'adm-2019-002.parent@portal',  'parent123',  'parent',  'active'),
  (9,  1, 2, 'Brian Kamau (Student)',    'adm-2019-002.student@portal', 'student123', 'student', 'active'),
  (10, 1, 3, 'Mr. Peter Mutua (Parent)', 'adm-2021-003.parent@portal',  'parent123',  'parent',  'active'),
  (11, 1, 3, 'Chloe Mutua (Student)',    'adm-2021-003.student@portal', 'student123', 'student', 'active')
ON CONFLICT DO NOTHING;

-- Keep identity sequence in sync if we inserted explicit IDs.
SELECT setval(
  pg_get_serial_sequence('public.users', 'user_id'),
  COALESCE((SELECT MAX(user_id) FROM public.users), 1)
);

