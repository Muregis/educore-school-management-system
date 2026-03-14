-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `subjects` table (requires `schools`).

INSERT INTO public.subjects
  (subject_id, school_id, subject_name, code, status)
VALUES
  (1, 1, 'Mathematics', 'MAT', 'active'),
  (2, 1, 'English',     'ENG', 'active'),
  (3, 1, 'Biology',     'BIO', 'active'),
  (4, 1, 'Physics',     'PHY', 'active')
ON CONFLICT (subject_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.subjects', 'subject_id'),
  COALESCE((SELECT MAX(subject_id) FROM public.subjects), 1)
);

