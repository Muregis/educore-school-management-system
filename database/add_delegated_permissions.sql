-- Add delegated_permissions column to users table
-- This allows Directors to delegate specific permissions to Admins
-- Run in Supabase SQL Editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS delegated_permissions JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on delegated permissions
CREATE INDEX IF NOT EXISTS idx_users_delegated_permissions 
ON public.users USING GIN (delegated_permissions);

-- Done - Directors can now delegate permissions to Admins
