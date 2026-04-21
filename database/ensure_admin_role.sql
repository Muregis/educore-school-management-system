-- Ensure admin@realpeakeducationcentre.ac.ke has admin role (limited permissions)
-- This account will have basic secretary-level access only
-- Run in Supabase SQL Editor

-- Update existing user to admin if email exists
UPDATE public.users
SET role = 'admin',
    password_hash = '$2a$10$/gdxKvESz.70KElO6WNGbO29SFt5CKBCdWdekM6zETsyTsICEgJse',
    updated_at = NOW()
WHERE email = 'admin@realpeakeducationcentre.ac.ke';

-- Insert admin user if doesn't exist
INSERT INTO public.users (
  email,
  password_hash,
  role,
  full_name,
  school_id,
  created_at,
  updated_at
)
SELECT
  'admin@realpeakeducationcentre.ac.ke',
  '$2a$10$/gdxKvESz.70KElO6WNGbO29SFt5CKBCdWdekM6zETsyTsICEgJse',
  'admin',
  'Admin',
  3, -- Real Peak Education Centre (RPK-001)
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE email = 'admin@realpeakeducationcentre.ac.ke'
);

-- Done - admin@realpeakeducationcentre.ac.ke is now strictly admin (limited permissions)
-- Login with: admin@realpeakeducationcentre.ac.ke / Admin123
