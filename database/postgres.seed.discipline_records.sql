-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `discipline_records` table.

INSERT INTO public.discipline_records
  (discipline_id, school_id, student_id, teacher_id, incident_type, incident_details, action_taken, incident_date, status)
VALUES
  (1, 1, 2, 2, 'Late coming', 'Student arrived 40 minutes late', 'Parent notified', '2026-03-01', 'closed')
ON CONFLICT (discipline_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.discipline_records', 'discipline_id'),
  COALESCE((SELECT MAX(discipline_id) FROM public.discipline_records), 1)
);

