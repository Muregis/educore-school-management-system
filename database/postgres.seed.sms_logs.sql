-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `sms_logs` table.

INSERT INTO public.sms_logs
  (sms_id, school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
VALUES
  (1, 1, '+254712345678', 'Fee reminder: Kindly clear outstanding balance.', 'sms', 'sent', 3, '2026-03-05 10:15:00')
ON CONFLICT (sms_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.sms_logs', 'sms_id'),
  COALESCE((SELECT MAX(sms_id) FROM public.sms_logs), 1)
);

