-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `student_guardians` table.

INSERT INTO public.student_guardians
  (id, school_id, student_id, guardian_id, can_pickup, financial_responsibility)
VALUES
  (1, 1, 1, 1, TRUE, TRUE),
  (2, 1, 4, 1, TRUE, TRUE),
  (3, 1, 2, 2, TRUE, TRUE),
  (4, 1, 3, 3, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.student_guardians', 'id'),
  COALESCE((SELECT MAX(id) FROM public.student_guardians), 1)
);

