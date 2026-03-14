-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `class_subjects` table (requires `schools`, `classes`, `subjects`, `teachers`).

INSERT INTO public.class_subjects
  (class_subject_id, school_id, class_id, subject_id, teacher_id)
VALUES
  (1, 1, 3, 1, 1),
  (2, 1, 3, 2, 2),
  (3, 1, 4, 1, 1),
  (4, 1, 4, 2, 2),
  (5, 1, 4, 3, 1),
  (6, 1, 4, 4, 1)
ON CONFLICT (class_subject_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.class_subjects', 'class_subject_id'),
  COALESCE((SELECT MAX(class_subject_id) FROM public.class_subjects), 1)
);

