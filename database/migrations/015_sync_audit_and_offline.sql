-- ============================================================================
-- EduCore: Sync Audit Log and Offline Support Migration
-- Created: 2026-04-24
-- ============================================================================

-- ============================================================================
-- 1. SYNC AUDIT LOG TABLE
-- Complete audit trail for offline sync operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  user_id BIGINT NOT NULL REFERENCES public.users(user_id),
  school_id BIGINT NOT NULL REFERENCES public.schools(school_id),
  action_type VARCHAR(50) NOT NULL,  -- 'attendance', 'grade', 'payment'
  local_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ DEFAULT NOW(),
  local_checksum VARCHAR(64) NOT NULL,
  server_record_id BIGINT,
  sync_status VARCHAR(20) NOT NULL,  -- 'accepted', 'rejected', 'conflict'
  error_message TEXT,
  raw_payload JSONB NOT NULL,
  conflict_resolution JSONB,
  resolved_by BIGINT REFERENCES public.users(user_id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sync_audit_device ON public.sync_audit_log(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_user ON public.sync_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_school ON public.sync_audit_log(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_checksum ON public.sync_audit_log(local_checksum);
CREATE INDEX IF NOT EXISTS idx_sync_audit_status ON public.sync_audit_log(sync_status, school_id);

-- ============================================================================
-- 2. OFFLINE SUPPORT COLUMNS (Add to existing tables)
-- ============================================================================

-- Add version tracking to attendance
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_synced BOOLEAN DEFAULT TRUE;

-- Add version tracking to results (grades)
ALTER TABLE public.results 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_synced BOOLEAN DEFAULT TRUE;

-- Add version tracking to payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;

-- ============================================================================
-- 3. TRIGGER FUNCTIONS FOR VERSION MANAGEMENT
-- ============================================================================

-- Function to increment version on update
CREATE OR REPLACE FUNCTION increment_record_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE(OLD.version, 1) + 1;
  NEW.updated_at = NOW();
  NEW.is_synced = FALSE;  -- Mark as not synced after update
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to attendance
DROP TRIGGER IF EXISTS attendance_version_trigger ON public.attendance;
CREATE TRIGGER attendance_version_trigger
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION increment_record_version();

-- Apply to results
DROP TRIGGER IF EXISTS results_version_trigger ON public.results;
CREATE TRIGGER results_version_trigger
  BEFORE UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION increment_record_version();

-- Apply to payments
DROP TRIGGER IF EXISTS payments_version_trigger ON public.payments;
CREATE TRIGGER payments_version_trigger
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION increment_record_version();

-- ============================================================================
-- 4. RLS POLICIES FOR SYNC AUDIT LOG
-- ============================================================================

ALTER TABLE public.sync_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sync history or school-wide for admins
CREATE POLICY sync_audit_school_isolation ON public.sync_audit_log
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_school_id() AND
    (
      -- Users see their own
      user_id = auth.uid() OR
      -- Admins see all for their school
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_id = auth.uid() 
        AND role IN ('director', 'admin', 'superadmin')
      )
    )
  );

-- Only system can insert sync logs
CREATE POLICY sync_audit_insert ON public.sync_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_school_id() AND
    user_id = auth.uid()
  );

-- ============================================================================
-- 5. HELPER FUNCTION: Mark records as synced
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_record_synced(
  p_table_name VARCHAR(50),
  p_record_id BIGINT,
  p_device_id VARCHAR(100)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE p_table_name
    WHEN 'attendance' THEN
      UPDATE public.attendance 
      SET is_synced = TRUE, device_id = p_device_id
      WHERE attendance_id = p_record_id;
    WHEN 'results' THEN
      UPDATE public.results 
      SET is_synced = TRUE, device_id = p_device_id
      WHERE result_id = p_record_id;
    WHEN 'payments' THEN
      UPDATE public.payments 
      SET device_id = p_device_id
      WHERE payment_id = p_record_id;
  END CASE;
END;
$$;

-- ============================================================================
-- 6. VIEW: PENDING SYNC SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW pending_sync_summary AS
SELECT 
  school_id,
  COUNT(*) FILTER (WHERE sync_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE sync_status = 'conflict') as conflict_count,
  COUNT(*) FILTER (WHERE sync_status = 'rejected') as rejected_count,
  MAX(server_timestamp) as last_sync
FROM public.sync_audit_log
GROUP BY school_id;

-- ============================================================================
-- 7. FUNCTION: GET STUDENTS BY PARENT PHONE (for parent portal)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_students_by_parent_phone(p_phone VARCHAR)
RETURNS TABLE (
  student_id BIGINT,
  first_name VARCHAR,
  last_name VARCHAR,
  class_name VARCHAR,
  parent_phone VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.student_id,
    s.first_name,
    s.last_name,
    s.class_name,
    s.parent_phone
  FROM public.students s
  WHERE s.parent_phone = p_phone
    AND s.is_deleted = false;
END;
$$;

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

SELECT 'Migration 015_sync_audit_and_offline applied successfully' as status;
