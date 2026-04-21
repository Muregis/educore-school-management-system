-- Check if your user has director role
-- Replace with your actual email
SELECT user_id, email, role, full_name, school_id 
FROM users 
WHERE email = 'director@example.com';  -- <-- CHANGE THIS to your login email

-- Or list all directors
SELECT user_id, email, role, full_name, school_id 
FROM users 
WHERE role = 'director';
