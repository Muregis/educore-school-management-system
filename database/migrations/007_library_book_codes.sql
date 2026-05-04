-- Migration: 007_library_book_codes
-- Description: Add book identification system with school shortcode format

-- Add shortcode config to schools table
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS library_shortcode VARCHAR(20),
ADD COLUMN IF NOT EXISTS library_year_sequence JSONB DEFAULT '{}';
-- library_year_sequence stores per-year counters: {"2024": 45, "2025": 78, "2026": 20}
-- Sequence resets each year automatically

-- Create base library_books table if it doesn't exist
CREATE TABLE IF NOT EXISTS library_books (
  book_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  title VARCHAR(255) NOT NULL,
  author VARCHAR(160),
  publisher VARCHAR(160),
  publication_year INTEGER,
  category VARCHAR(100),
  shelf_location VARCHAR(50),
  total_copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT false,
  added_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create base library_book_copies table if it doesn't exist
CREATE TABLE IF NOT EXISTS library_book_copies (
  copy_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  book_id BIGINT NOT NULL REFERENCES library_books(book_id),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create base library_borrowings table if it doesn't exist
CREATE TABLE IF NOT EXISTS library_borrowings (
  borrowing_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  book_id BIGINT NOT NULL REFERENCES library_books(book_id),
  student_id BIGINT NOT NULL REFERENCES students(student_id),
  borrowed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  returned_date DATE,
  status VARCHAR(20) DEFAULT 'borrowed',
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add code fields to library_books
ALTER TABLE library_books
ADD COLUMN IF NOT EXISTS book_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
ADD COLUMN IF NOT EXISTS year_added INTEGER,
ADD COLUMN IF NOT EXISTS isbn VARCHAR(50);

-- Add unique constraint only within school
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_code_school 
ON library_books(school_id, book_code) 
WHERE is_deleted = false;

-- Add code fields to library_book_copies
ALTER TABLE library_book_copies
ADD COLUMN IF NOT EXISTS copy_code VARCHAR(60),
ADD COLUMN IF NOT EXISTS copy_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS qr_data TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available',
ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'good',
ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lost_by INTEGER REFERENCES students(student_id),
ADD COLUMN IF NOT EXISTS lost_date DATE,
ADD COLUMN IF NOT EXISTS replacement_status VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS replacement_accepted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS replacement_accepted_by INTEGER REFERENCES users(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_copies_code_school
ON library_book_copies(school_id, copy_code)
WHERE is_deleted = false;

-- Add copy tracking to borrowings
ALTER TABLE library_borrowings
ADD COLUMN IF NOT EXISTS copy_id INTEGER 
  REFERENCES library_book_copies(copy_id),
ADD COLUMN IF NOT EXISTS return_condition VARCHAR(20),
ADD COLUMN IF NOT EXISTS lost_reported_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS replacement_deadline DATE,
ADD COLUMN IF NOT EXISTS replacement_status VARCHAR(20) DEFAULT 'none';

-- Function to get next sequence for school+year
CREATE OR REPLACE FUNCTION get_next_book_sequence(
  p_school_id INTEGER,
  p_year INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  current_seq JSONB;
  next_num INTEGER;
  year_key TEXT;
BEGIN
  year_key := p_year::TEXT;
  
  SELECT library_year_sequence INTO current_seq
  FROM schools WHERE school_id = p_school_id
  FOR UPDATE;
  
  next_num := COALESCE(
    (current_seq->>year_key)::INTEGER, 0
  ) + 1;
  
  UPDATE schools
  SET library_year_sequence = 
    COALESCE(library_year_sequence, '{}'::jsonb) || 
    jsonb_build_object(year_key, next_num)
  WHERE school_id = p_school_id;
  
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS get_next_book_sequence;
-- DROP INDEX IF EXISTS idx_books_code_school;
-- DROP INDEX IF EXISTS idx_copies_code_school;
-- ALTER TABLE library_borrowings DROP COLUMN IF EXISTS copy_id;
-- ALTER TABLE library_borrowings DROP COLUMN IF EXISTS return_condition;
-- ALTER TABLE library_borrowings DROP COLUMN IF EXISTS lost_reported_at;
-- ALTER TABLE library_borrowings DROP COLUMN IF EXISTS replacement_deadline;
-- ALTER TABLE library_borrowings DROP COLUMN IF EXISTS replacement_status;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS copy_code;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS copy_number;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS qr_data;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS status;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS condition;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS is_lost;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS lost_by;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS lost_date;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS replacement_status;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS replacement_accepted_at;
-- ALTER TABLE library_book_copies DROP COLUMN IF EXISTS replacement_accepted_by;
-- ALTER TABLE library_books DROP COLUMN IF EXISTS book_code;
-- ALTER TABLE library_books DROP COLUMN IF EXISTS sequence_number;
-- ALTER TABLE library_books DROP COLUMN IF EXISTS year_added;
-- ALTER TABLE library_books DROP COLUMN IF EXISTS isbn;
-- ALTER TABLE schools DROP COLUMN IF EXISTS library_shortcode;
-- ALTER TABLE schools DROP COLUMN IF EXISTS library_year_sequence;
