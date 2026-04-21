-- Create Director User Account
-- Email: director@realpeakeducationcentre.ac.ke
-- Password: Director123 (change after first login)
-- Run in Supabase SQL Editor

-- Update existing user to director if email exists
UPDATE public.users
SET role = 'director',
    password_hash = '$2a$10$HY4rN1Bxd9.ejPKOJvA0c.nJrRa16lCl3eRiZNZGOHjoJy8xOZnX.',
    updated_at = NOW()
WHERE email = 'director@realpeakeducationcentre.ac.ke';

-- Insert director user if doesn't exist
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
  'director@realpeakeducationcentre.ac.ke',
  '$2a$10$HY4rN1Bxd9.ejPKOJvA0c.nJrRa16lCl3eRiZNZGOHjoJy8xOZnX.', -- bcryptjs hash for "Director123"',
  'director',
  'Director',
  3, -- Real Peak Education Centre (RPK-001)
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE email = 'director@realpeakeducationcentre.ac.ke'
);

-- Done - Director account created or updated
-- Login with: director@realpeakeducationcentre.ac.ke / Director123
