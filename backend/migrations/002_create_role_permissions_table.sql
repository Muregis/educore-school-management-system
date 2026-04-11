-- Migration: Create role_permissions table
-- Date: 2026-04-11
-- Description: Adds table for storing role-based page permissions per school

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    can_edit BOOLEAN DEFAULT false,
    pages_json TEXT DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, role_name)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_school_role ON role_permissions(school_id, role_name);

-- Add RLS (Row Level Security) policies
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access permissions for their own school
CREATE POLICY "Users can access role permissions for their school" ON role_permissions
    FOR ALL USING (school_id = current_setting('app.current_school_id', true)::integer);

-- Grant permissions
GRANT ALL ON role_permissions TO authenticated;
GRANT USAGE ON SEQUENCE role_permissions_id_seq TO authenticated;