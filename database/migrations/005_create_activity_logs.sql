-- Migration: Create activity_logs table
-- Referenced in activity.logger.js but missing from schema

-- Create activity_logs table (PostgreSQL syntax)
CREATE TABLE IF NOT EXISTS activity_logs (
  activity_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50) NULL,
  entity_id BIGINT NULL,
  description TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_school_user ON activity_logs(school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity, entity_id);

-- Add RLS policy for tenant isolation
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see activity logs from their own school
CREATE POLICY activity_logs_school_isolation ON activity_logs
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Add foreign key constraints (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE activity_logs 
        ADD CONSTRAINT fk_activity_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
        ALTER TABLE activity_logs 
        ADD CONSTRAINT fk_activity_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id);
    END IF;
END $$;

COMMENT ON TABLE activity_logs IS 'General activity log for user actions and system events';
COMMENT ON COLUMN activity_logs.action IS 'Action performed (e.g., auth.login, student.create)';
COMMENT ON COLUMN activity_logs.entity IS 'Entity type (e.g., student, payment, grade)';
COMMENT ON COLUMN activity_logs.entity_id IS 'ID of the entity that was acted upon';
