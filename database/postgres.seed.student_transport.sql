-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `student_transport` table.

INSERT INTO public.student_transport
  (id, school_id, student_id, transport_id, start_date, status)
VALUES
  (1, 1, 1, 1, '2026-01-10', 'active')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.student_transport', 'id'),
  COALESCE((SELECT MAX(id) FROM public.student_transport), 1)
);

