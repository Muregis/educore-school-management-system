-- Migration: Create audit_logs table (FIXED)
-- FIX: Changed 'timestamp' column to 'created_at' to match the code in audit.logger.js
-- and to be consistent with other tables in the schema

CREATE TABLE IF NOT EXISTS public.audit_logs (
  audit_id    BIGSERIAL PRIMARY KEY,
  school_id   BIGINT NOT NULL,
  user_id     BIGINT NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50)  NULL,
  entity_id   BIGINT NULL,
  old_values  JSONB NULL,
  new_values  JSONB NULL,
  description TEXT NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  TEXT NULL,
  -- FIX: was 'timestamp', must be 'created_at' to match audit.logger.js INSERT
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_school_user      ON public.audit_logs(school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action           ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at       ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity           ON public.audit_logs(entity_type, entity_id);

-- Add FK constraints if parent tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schools') THEN
        BEGIN
            ALTER TABLE public.audit_logs ADD CONSTRAINT fk_audit_logs_school
                FOREIGN KEY (school_id) REFERENCES public.schools(school_id);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN
        BEGIN
            ALTER TABLE public.audit_logs ADD CONSTRAINT fk_audit_logs_user
                FOREIGN KEY (user_id) REFERENCES public.users(user_id);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs from their school only" ON public.audit_logs;
CREATE POLICY "Users can view audit logs from their school only" ON public.audit_logs
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "No updates to audit logs" ON public.audit_logs;
CREATE POLICY "No updates to audit logs" ON public.audit_logs
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "No deletes to audit logs" ON public.audit_logs;
CREATE POLICY "No deletes to audit logs" ON public.audit_logs
  FOR DELETE USING (false);

COMMENT ON TABLE public.audit_logs IS 'Audit trail for sensitive operations';
COMMENT ON COLUMN public.audit_logs.action IS 'Action performed e.g. grade.create, payment.update';
COMMENT ON COLUMN public.audit_logs.old_values IS 'State before change (JSON)';
COMMENT ON COLUMN public.audit_logs.new_values IS 'State after change (JSON)';