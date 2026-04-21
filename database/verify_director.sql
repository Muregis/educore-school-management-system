-- Verify director user exists and has correct role
SELECT user_id, email, role, school_id, full_name 
FROM public.users 
WHERE email = 'director@realpeakeducationcentre.ac.ke';

-- If no result, run this to create director in production:
UPDATE public.users
SET role = 'director',
    password_hash = '$2a$10$HY4rN1Bxd9.ejPKOJvA0c.nJrRa16lCl3eRiZNZGOHjoJy8xOZnX.',
    updated_at = NOW()
WHERE email = 'director@realpeakeducationcentre.ac.ke';

INSERT INTO public.users (
  email, password_hash, role, full_name, school_id, created_at, updated_at
)
SELECT
  'director@realpeakeducationcentre.ac.ke',
  '$2a$10$HY4rN1Bxd9.ejPKOJvA0c.nJrRa16lCl3eRiZNZGOHjoJy8xOZnX.',
  'director',
  'Director',
  3,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE email = 'director@realpeakeducationcentre.ac.ke'
);
