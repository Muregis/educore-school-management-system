-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `exams` table (requires `schools`).

INSERT INTO public.exams
  (exam_id, school_id, exam_name, term, academic_year, start_date, end_date, status)
VALUES
  (1, 1, 'Midterm', 'Term 2', 2026, '2026-06-10', '2026-06-14', 'published')
ON CONFLICT (exam_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.exams', 'exam_id'),
  COALESCE((SELECT MAX(exam_id) FROM public.exams), 1)
);

