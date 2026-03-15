-- EduCore Postgres/Supabase seed (Step 3)
-- Seeds ONLY the `schools` table.

INSERT INTO public.schools
  (school_id, name, code, email, phone, address, county, subscription_status, subscription_start, subscription_end)
VALUES
  (1, 'Greenfield Academy', 'GFA-001', 'admin@greenfield.ac.ke', '+254712345678', '123 Ngong Road, Nairobi', 'Nairobi', 'active', '2026-01-01', '2026-12-31'),
  (2, 'Hillview High School', 'HHS-002', 'admin@hillview.ac.ke', '+254798765432', '456 Mombasa Road, Mombasa', 'Mombasa', 'active', '2026-01-01', '2026-12-31')
ON CONFLICT (school_id) DO NOTHING;

-- Keep identity sequence in sync if we inserted explicit IDs.
SELECT setval(
  pg_get_serial_sequence('public.schools', 'school_id'),
  COALESCE((SELECT MAX(school_id) FROM public.schools), 1)
);

