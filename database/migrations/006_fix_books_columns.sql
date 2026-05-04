-- Migration: 006_fix_books_columns
-- Description: Ensure all required columns exist in books table

-- Add missing columns to books table if they don't exist
ALTER TABLE books
ADD COLUMN IF NOT EXISTS category VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS isbn VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS quantity_total INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_available INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_books_school_title ON books (school_id, title);
CREATE INDEX IF NOT EXISTS idx_books_deleted ON books (is_deleted);

-- ROLLBACK:
-- ALTER TABLE books DROP COLUMN IF EXISTS category;
-- ALTER TABLE books DROP COLUMN IF EXISTS isbn;
-- ALTER TABLE books DROP COLUMN IF EXISTS quantity_total;
-- ALTER TABLE books DROP COLUMN IF EXISTS quantity_available;
-- ALTER TABLE books DROP COLUMN IF EXISTS is_deleted;
-- ALTER TABLE books DROP COLUMN IF EXISTS status;
-- DROP INDEX IF EXISTS idx_books_school_title;
-- DROP INDEX IF EXISTS idx_books_deleted;
