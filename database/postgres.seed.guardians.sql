-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `guardians` table.

INSERT INTO public.guardians
  (guardian_id, school_id, first_name, last_name, relationship_type, phone, email, occupation, address, is_primary, status)
VALUES
  (1, 1, 'Kofi',  'Osei',  'father', '0712345678', 'kofi.osei@mail.com',   'Business', 'Nairobi', TRUE,  'active'),
  (2, 1, 'Mary',  'Kamau', 'mother', '0723456789', 'mary.kamau@mail.com',  'Nurse',    'Nairobi', TRUE,  'active'),
  (3, 1, 'Peter', 'Mutua', 'father', '0734567890', 'peter.mutua@mail.com', 'Engineer', 'Nairobi', TRUE,  'active')
ON CONFLICT (guardian_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.guardians', 'guardian_id'),
  COALESCE((SELECT MAX(guardian_id) FROM public.guardians), 1)
);

