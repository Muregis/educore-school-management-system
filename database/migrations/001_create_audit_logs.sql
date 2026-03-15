-- Migration: Create audit_logs table
-- This table is referenced in audit.logger.js but missing from schema

-- Create audit_logs table (PostgreSQL syntax)
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id BIGINT NULL,
  old_values JSONB NULL,
  new_values JSONB NULL,
  description TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_school_user ON audit_logs(school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Add RLS policy for tenant isolation
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see audit logs from their own school
CREATE POLICY audit_logs_school_isolation ON audit_logs
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

COMMENT ON TABLE audit_logs IS 'Audit trail for sensitive operations across the platform';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., grade.create, payment.update)';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous state before the change';
COMMENT ON COLUMN audit_logs.new_values IS 'New state after the change';
