-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `payments` table.
--
-- Seed payments in `database/seed.sql` do not include `invoice_id`; we keep it NULL here.

INSERT INTO public.payments
  (payment_id, school_id, student_id, invoice_id, fee_structure_id, amount, fee_type, payment_method, reference_number, payment_date, status, term, paid_by)
VALUES
  (1, 1, 1, NULL, NULL, 15000, 'tuition',  'mpesa', 'QWE123XYZ', '2026-03-02', 'paid', 'Term 2', 'Mr. Kofi Osei'),
  (2, 1, 2, NULL, NULL,  8000, 'tuition',  'bank',  'BNK778899', '2026-03-03', 'paid', 'Term 2', 'Mrs. Mary Kamau'),
  (3, 1, 3, NULL, NULL,  2000, 'activity', 'cash',  'CASH-001',  '2026-03-04', 'paid', 'Term 2', 'Mr. Peter Mutua')
ON CONFLICT (payment_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.payments', 'payment_id'),
  COALESCE((SELECT MAX(payment_id) FROM public.payments), 1)
);

