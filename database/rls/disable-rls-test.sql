-- Temporarily disable RLS for testing
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;

-- This will allow us to test if our JWT authentication works at all
-- Run this, then test with our Node.js client again
-- If it works without RLS, the issue is with the policy
-- If it still fails, the issue is with JWT format
