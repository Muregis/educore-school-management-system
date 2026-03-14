-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `borrow_records` table.

INSERT INTO public.borrow_records
  (borrow_id, school_id, book_id, borrower_id, borrower_type, borrow_date, due_date, status)
VALUES
  (1, 1, 1, 1, 'student', '2026-03-01', '2026-03-15', 'borrowed')
ON CONFLICT (borrow_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.borrow_records', 'borrow_id'),
  COALESCE((SELECT MAX(borrow_id) FROM public.borrow_records), 1)
);

