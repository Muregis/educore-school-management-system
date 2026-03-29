-- 010_enforce_tenant_isolation_rls.sql
-- Enforces strict tenant isolation using school_id + JWT claim mapping.

BEGIN;

-- Resolve school_id from Supabase JWT claims.
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'school_id', '')::bigint,
    NULLIF(auth.jwt() ->> 'schoolId', '')::bigint
  )
$$;

-- Add school_id to tenant tables where missing.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'users',
    'students',
    'activity_logs',
    'audit_logs',
    'attendance',
    'results',
    'payments',
    'invoices',
    'report_cards',
    'student_ledger',
    'discipline_records',
    'teachers',
    'classes',
    'announcements',
    'fee_structures',
    'sms_logs',
    'transport_routes',
    'timetable_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS school_id bigint', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_school_id ON public.%I (school_id)', t, t);
    END IF;
  END LOOP;
END $$;

-- Enable and force RLS on tenant tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'users',
    'students',
    'activity_logs',
    'audit_logs',
    'attendance',
    'results',
    'payments',
    'invoices',
    'report_cards',
    'student_ledger',
    'discipline_records',
    'teachers',
    'classes',
    'announcements',
    'fee_structures',
    'sms_logs',
    'transport_routes',
    'timetable_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Replace tenant policies on all target tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'users',
    'students',
    'activity_logs',
    'audit_logs',
    'attendance',
    'results',
    'payments',
    'invoices',
    'report_cards',
    'student_ledger',
    'discipline_records',
    'teachers',
    'classes',
    'announcements',
    'fee_structures',
    'sms_logs',
    'transport_routes',
    'timetable_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_select_%I ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_insert_%I ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_update_%I ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_delete_%I ON public.%I', t, t);

      EXECUTE format(
        'CREATE POLICY tenant_select_%I ON public.%I FOR SELECT USING (school_id = public.current_school_id())',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY tenant_insert_%I ON public.%I FOR INSERT WITH CHECK (school_id = public.current_school_id())',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY tenant_update_%I ON public.%I FOR UPDATE USING (school_id = public.current_school_id()) WITH CHECK (school_id = public.current_school_id())',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY tenant_delete_%I ON public.%I FOR DELETE USING (school_id = public.current_school_id())',
        t, t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
