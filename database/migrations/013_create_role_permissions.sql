-- Migration: Create role_permissions table
-- For managing role-based permissions per school

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  role_name VARCHAR(50) NOT NULL,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  pages_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_school ON role_permissions(school_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_name);

COMMENT ON TABLE role_permissions IS 'Role-based permissions configuration per school';

-- Insert default permissions for all existing schools
INSERT INTO role_permissions (school_id, role_name, can_edit, pages_json)
SELECT 
  school_id,
  role_name,
  can_edit,
  pages_json
FROM (
  VALUES
    -- Superadmin: Full access
    (1, 'superadmin', true, '["*"]'::jsonb),
    -- Director: Full access to school management
    (1, 'director', true, '["dashboard","students","staff","attendance","grades","subjects","fees","expenditures","admissions","invoices","reportcards","discipline","transport","announcements","lesson-plans","exams","library","analysis","activity-logs","branches","admin-permissions","performance","promotion","notifications","discounts"]'::jsonb),
    -- Admin: Most school management features
    (1, 'admin', true, '["dashboard","students","staff","attendance","grades","subjects","fees","expenditures","admissions","invoices","reportcards","discipline","transport","announcements","lesson-plans","exams","library","analysis"]'::jsonb),
    -- Teacher: Classroom management
    (1, 'teacher', false, '["dashboard","students","attendance","grades","subjects","lesson-plans","exams","library"]'::jsonb),
    -- Parent: View child's information
    (1, 'parent', false, '["dashboard","students","attendance","grades","reportcards","fees","announcements"]'::jsonb),
    -- Student: View own information
    (1, 'student', false, '["dashboard","attendance","grades","reportcards","fees","announcements","library"]'::jsonb)
) AS default_perms(school_id, role_name, can_edit, pages_json)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role_permissions.school_id = default_perms.school_id 
  AND role_permissions.role_name = default_perms.role_name
);

SELECT 'role_permissions table created successfully' AS status;
