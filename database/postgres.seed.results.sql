-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `results` table (requires `schools`, `students`, `classes`, `teachers`).

INSERT INTO public.results
  (result_id, school_id, student_id, subject, term, marks, total_marks, grade, class_id, teacher_id, teacher_comment)
VALUES
  (1, 1, 1, 'Mathematics', 'Term 2', 87, 100, 'ME', 3, 1, 'Good work'),
  (2, 1, 1, 'English',     'Term 2', 74, 100, 'ME', 3, 2, 'Keep improving'),
  (3, 1, 2, 'Mathematics', 'Term 2', 92, 100, 'EE', 4, 1, 'Excellent'),
  (4, 1, 4, 'Mathematics', 'Term 2', 78, 100, 'ME', 1, 1, 'Well done Kevin')
ON CONFLICT (result_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.results', 'result_id'),
  COALESCE((SELECT MAX(result_id) FROM public.results), 1)
);

