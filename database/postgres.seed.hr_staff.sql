-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `hr_staff` table.

INSERT INTO public.hr_staff
  (staff_id, school_id, full_name, email, phone, national_id, department, job_title, contract_type, start_date, salary, status)
VALUES
  (1, 1, 'Mrs. Wanjiku',  'admin@greenfield.ac.ke',   '+254712345678', '11111111', 'Administration', 'School Principal',    'Permanent', '2020-01-01', 85000, 'active'),
  (2, 1, 'Grace Akinyi',  'teacher@greenfield.ac.ke', '+254711222333', '22222222', 'Academic',       'Mathematics Teacher', 'Permanent', '2024-01-15', 55000, 'active'),
  (3, 1, 'James Mwangi',  'j.mwangi@greenfield.ac.ke','+254722333444', '33333333', 'Academic',       'English Teacher',     'Permanent', '2023-09-01', 55000, 'active'),
  (4, 1, 'Peter Maina',   'finance@greenfield.ac.ke', '+254733444555', '44444444', 'Finance',        'Finance Officer',     'Permanent', '2022-03-01', 60000, 'active'),
  (5, 1, 'Jane Otieno',   'hr@greenfield.ac.ke',      '+254755666777', '55555555', 'Administration', 'HR Officer',          'Permanent', '2023-01-01', 58000, 'active'),
  (6, 1, 'Daniel Kariuki','',                         '+254744556677', '66666666', 'Transport',      'Driver',              'Contract',  '2024-06-01', 30000, 'active')
ON CONFLICT (staff_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.hr_staff', 'staff_id'),
  COALESCE((SELECT MAX(staff_id) FROM public.hr_staff), 1)
);

