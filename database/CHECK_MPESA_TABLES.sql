-- VERIFICATION: Check if MPesa tables exist
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN ('mpesa_unmatched', 'mpesa_reconciliation_logs')
  AND schemaname = 'public';

-- If no results, run the table creation below