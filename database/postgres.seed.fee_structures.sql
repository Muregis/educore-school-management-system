-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `fee_structures` table (requires `schools`).

INSERT INTO public.fee_structures
  (fee_structure_id, school_id, class_name, term, tuition, activity, misc)
VALUES
  (1, 1, 'Grade 5', 'Term 2', 14000, 1500, 500),
  (2, 1, 'Grade 6', 'Term 2', 15000, 2000, 500),
  (3, 1, 'Grade 7', 'Term 2', 16000, 2000, 500),
  (4, 1, 'Grade 8', 'Term 2', 17000, 2000, 500)
ON CONFLICT (fee_structure_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.fee_structures', 'fee_structure_id'),
  COALESCE((SELECT MAX(fee_structure_id) FROM public.fee_structures), 1)
);

