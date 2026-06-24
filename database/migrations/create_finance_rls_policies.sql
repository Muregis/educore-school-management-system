-- RLS Policies for Finance Tables
-- Enable Row Level Security and create tenant isolation policies
-- Run this AFTER create_missing_finance_tables.sql

-- =====================================================
-- CHART OF ACCOUNTS RLS
-- =====================================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chart of accounts from their school only" ON chart_of_accounts
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert chart of accounts for their school only" ON chart_of_accounts
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update chart of accounts from their school only" ON chart_of_accounts
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can delete chart of accounts from their school only" ON chart_of_accounts
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- JOURNAL ENTRIES RLS
-- =====================================================
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view journal entries from their school only" ON journal_entries
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert journal entries for their school only" ON journal_entries
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update journal entries from their school only" ON journal_entries
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- JOURNAL ENTRY LINES RLS
-- =====================================================
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view journal entry lines from their school only" ON journal_entry_lines
  FOR SELECT
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries 
      WHERE school_id = (auth.jwt() ->> 'school_id')::bigint
    )
  );

CREATE POLICY "Users can insert journal entry lines for their school only" ON journal_entry_lines
  FOR INSERT
  WITH CHECK (
    journal_entry_id IN (
      SELECT id FROM journal_entries 
      WHERE school_id = (auth.jwt() ->> 'school_id')::bigint
    )
  );

CREATE POLICY "Users can update journal entry lines from their school only" ON journal_entry_lines
  FOR UPDATE
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries 
      WHERE school_id = (auth.jwt() ->> 'school_id')::bigint
    )
  );

-- =====================================================
-- STUDENT LEDGER RLS
-- =====================================================
ALTER TABLE student_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ledger entries from their school only" ON student_ledger
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert ledger entries for their school only" ON student_ledger
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update ledger entries from their school only" ON student_ledger
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can delete ledger entries from their school only" ON student_ledger
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- FEE BALANCE LEDGER RLS
-- =====================================================
ALTER TABLE fee_balance_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fee balance ledger from their school only" ON fee_balance_ledger
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert fee balance ledger for their school only" ON fee_balance_ledger
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update fee balance ledger from their school only" ON fee_balance_ledger
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- PAYMENT PLANS RLS
-- =====================================================
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment plans from their school only" ON payment_plans
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert payment plans for their school only" ON payment_plans
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update payment plans from their school only" ON payment_plans
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can delete payment plans from their school only" ON payment_plans
  FOR DELETE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- DISCOUNT CONFIGS RLS
-- =====================================================
ALTER TABLE discount_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discount configs from their school only" ON discount_configs
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert discount configs for their school only" ON discount_configs
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update discount configs from their school only" ON discount_configs
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- STUDENT DISCOUNTS RLS
-- =====================================================
ALTER TABLE student_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view student discounts from their school only" ON student_discounts
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert student discounts for their school only" ON student_discounts
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update student discounts from their school only" ON student_discounts
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- ROLE PERMISSIONS RLS
-- =====================================================
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role permissions from their school only" ON role_permissions
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert role permissions for their school only" ON role_permissions
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can update role permissions from their school only" ON role_permissions
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- =====================================================
-- ACTIVITY LOGS RLS
-- =====================================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity logs from their school only" ON activity_logs
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "System can insert activity logs" ON activity_logs
  FOR INSERT
  WITH CHECK (true);

-- No UPDATE or DELETE for audit trail
CREATE POLICY "No updates to activity logs" ON activity_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to activity logs" ON activity_logs
  FOR DELETE
  USING (false);
