-- EduCore Postgres/Supabase seed (Step 3)
-- Seeds ONLY the `classes` table (requires `schools`).

INSERT INTO public.classes
  (class_id, school_id, class_name, section, class_teacher_id, academic_year, status)
VALUES
  (1, 1, 'Grade 5', 'A', 2,    2026, 'active'),
  (2, 1, 'Grade 6', 'A', 2,    2026, 'active'),
  (3, 1, 'Grade 7', 'A', 1,    2026, 'active'),
  (4, 1, 'Grade 8', 'A', NULL, 2026, 'active')
ON CONFLICT (class_id) DO NOTHING;

-- Keep identity sequence in sync if we inserted explicit IDs.
SELECT setval(
  pg_get_serial_sequence('public.classes', 'class_id'),
  COALESCE((SELECT MAX(class_id) FROM public.classes), 1)
);

