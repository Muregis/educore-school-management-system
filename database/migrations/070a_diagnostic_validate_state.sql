-- ============================================================
--  STEP 1 of 2 — DIAGNOSTIC: run this first in Supabase SQL Editor
--  It will tell us exactly what's missing.
--  Returns rows describing each triggered table's audit columns.
-- ============================================================
SELECT
    tg.tgname                                 AS trigger_name,
    cls.relname                                AS table_name,
    fn.proname                                 AS function_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name   = cls.relname
          AND c.column_name  = 'version'
    )                                          AS has_version_column,
    EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name   = cls.relname
          AND c.column_name  = 'created_by'
    )                                          AS has_created_by,
    EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name   = cls.relname
          AND c.column_name  = 'updated_by'
    )                                          AS has_updated_by
FROM pg_trigger tg
JOIN pg_class   cls ON cls.oid    = tg.tgrelid
JOIN pg_proc    fn  ON fn.oid     = tg.tgfoid
JOIN pg_namespace ns ON ns.oid    = cls.relnamespace
WHERE ns.nspname = 'public'
  AND fn.proname = 'update_updated_at_column'
  AND NOT tg.tgisinternal
ORDER BY cls.relname;

-- Also check the function body so we can see whether the "safe" version is installed
SELECT prosrc FROM pg_proc WHERE proname = 'update_updated_at_column';
