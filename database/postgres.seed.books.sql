-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `books` table.

INSERT INTO public.books
  (book_id, school_id, title, author, category, isbn, quantity_total, quantity_available, status)
VALUES
  (1, 1, 'Kenya Primary Maths 7', 'KICD',   'Mathematics', '9789966000001', 20, 18, 'active'),
  (2, 1, 'Oxford English 7',      'Oxford', 'Languages',   '9780190000002', 15, 15, 'active')
ON CONFLICT (book_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.books', 'book_id'),
  COALESCE((SELECT MAX(book_id) FROM public.books), 1)
);

