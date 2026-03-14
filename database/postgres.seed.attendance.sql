-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `attendance` table.

INSERT INTO public.attendance
  (attendance_id, school_id, student_id, class_id, attendance_date, status, marked_by_user_id)
VALUES
  (1, 1, 1, 3, '2026-03-01', 'present', 2),
  (2, 1, 2, 4, '2026-03-01', 'absent',  2),
  (3, 1, 3, 2, '2026-03-01', 'late',    2),
  (4, 1, 4, 1, '2026-03-01', 'present', 2)
ON CONFLICT (attendance_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.attendance', 'attendance_id'),
  COALESCE((SELECT MAX(attendance_id) FROM public.attendance), 1)
);

