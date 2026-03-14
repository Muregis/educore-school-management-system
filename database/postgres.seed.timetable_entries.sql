-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `timetable_entries` table.

INSERT INTO public.timetable_entries
  (timetable_id, school_id, class_id, subject_name, teacher_id, day_of_week, start_time, end_time, room)
VALUES
  (1, 1, 3, 'Mathematics', 1, 'Mon', '08:00', '09:00', 'Room 7A'),
  (2, 1, 3, 'English',     2, 'Mon', '09:00', '10:00', 'Room 7A'),
  (3, 1, 3, 'Physics',     1, 'Tue', '08:00', '09:00', 'Lab 1'),
  (4, 1, 3, 'Mathematics', 1, 'Wed', '08:00', '09:00', 'Room 7A'),
  (5, 1, 3, 'English',     2, 'Thu', '09:00', '10:00', 'Room 7A'),
  (6, 1, 3, 'Biology',     1, 'Fri', '08:00', '09:00', 'Lab 2')
ON CONFLICT (timetable_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.timetable_entries', 'timetable_id'),
  COALESCE((SELECT MAX(timetable_id) FROM public.timetable_entries), 1)
);

