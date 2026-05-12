-- Fix role_permissions table structure for proper Director access
-- Run this in Supabase SQL Editor

-- Create role_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id INTEGER NOT NULL,
    role_name TEXT NOT NULL,
    can_edit BOOLEAN DEFAULT false,
    pages_json JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, role_name)
);

-- Insert default permissions for common roles
INSERT INTO role_permissions (school_id, role_name, can_edit, pages_json) VALUES
-- Director permissions (full access)
(1, 'director', true, '["dashboard", "students", "staff", "attendance", "grades", "subjects", "fees", "mpesa-reconcile", "admissions", "invoices", "reportcards", "discipline", "transport", "communication", "messaging", "timetable", "reports", "analytics", "accounts", "hr", "library", "lessonplans", "pendingplans", "settings", "announcements", "bulk-import", "exams", "medical", "update-requests", "academic.view", "academic.manage", "promotion.view", "promotion.approve", "branch-management", "admin-permissions"]'),

-- Superadmin permissions (full system access)
(1, 'superadmin', true, '["dashboard", "students", "staff", "attendance", "grades", "subjects", "fees", "mpesa-reconcile", "admissions", "invoices", "reportcards", "discipline", "transport", "communication", "messaging", "timetable", "reports", "analytics", "accounts", "hr", "library", "lessonplans", "pendingplans", "settings", "announcements", "bulk-import", "exams", "medical", "update-requests", "academic.view", "academic.manage", "promotion.view", "promotion.approve", "branch-management"]'),

-- Admin permissions (limited access)
(1, 'admin', true, '["dashboard", "students", "attendance", "communication", "announcements", "academic.view", "academic.manage", "promotion.view", "promotion.approve"]'),

-- Teacher permissions
(1, 'teacher', false, '["dashboard", "attendance", "grades", "reportcards", "discipline", "timetable", "communication", "messaging", "library", "analysis", "lessonplans", "announcements", "exams", "academic.view", "students.view"]'),

-- Finance permissions
(1, 'finance', true, '["dashboard", "fees", "mpesa-reconcile", "invoices", "announcements", "upgrade"]'),

-- HR permissions
(1, 'hr', true, '["dashboard", "hr", "staff", "announcements", "upgrade"]'),

-- Parent permissions
(1, 'parent', false, '["dashboard", "grades", "fees", "reportcards", "attendance", "communication", "announcements", "update-requests", "students.view", "academic.view"]'),

-- Student permissions
(1, 'student', false, '["dashboard", "grades", "attendance", "reportcards", "library", "announcements", "academic.view"]'),

-- Librarian permissions
(1, 'librarian', false, '["dashboard", "library", "announcements"]')

ON CONFLICT (school_id, role_name) DO UPDATE SET
    can_edit = EXCLUDED.can_edit,
    pages_json = EXCLUDED.pages_json,
    updated_at = NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_role_permissions_school_role ON role_permissions(school_id, role_name);

-- Add RLS policies for role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view permissions for their own school
CREATE POLICY "Users can view role permissions for their school" ON role_permissions
    FOR SELECT USING (
        school_id = current_setting('app.current_school_id', true)::INTEGER
    );

-- Policy: Admins and Directors can manage permissions for their school
CREATE POLICY "Admins and Directors can manage role permissions" ON role_permissions
    FOR ALL USING (
        school_id = current_setting('app.current_school_id', true)::INTEGER
    );
