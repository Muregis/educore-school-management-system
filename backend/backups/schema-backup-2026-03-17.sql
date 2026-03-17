-- EduCore Schema Backup
-- Generated: 2026-03-17
-- Database: Supabase PostgreSQL (Project: slewmhaflrplgedgfvmz)

-- Key Tables:
--   - users (with RLS enabled)
--   - students (with RLS enabled)
--   - payments (with RLS enabled)
--   - schools
--   - classes
--   - teachers
--   - attendance
--   - grades
--   - fee_structures
--   - books
--   - borrow_records
--   - invoices
--   - report_cards
--   - activity_logs
--   - audit_logs

-- JWT Structure:
--   - school_id (BIGINT) - tenant identifier
--   - user_id - user identifier
--   - role - user role

-- RLS Policies Active:
--   - All tables have school_id based tenant isolation
--   - Users can only access data for their school_id

-- IMPORTANT: This backup serves as a reference point before migration cleanup
-- Branch: final-supabase-cleanup-debug
