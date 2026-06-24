-- Phase 7: Library Enterprise Upgrade
-- Enhance library tables for enterprise features

-- Add publisher and author fields to books table
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS publisher VARCHAR(200),
ADD COLUMN IF NOT EXISTS authors TEXT[],
ADD COLUMN IF NOT EXISTS isbn VARCHAR(20),
ADD COLUMN IF NOT EXISTS edition VARCHAR(50),
ADD COLUMN IF NOT EXISTS publication_year INTEGER,
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS barcode VARCHAR(50),
ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255),
ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'good', -- new, good, fair, poor
ADD COLUMN IF NOT EXISTS location VARCHAR(100),
ADD COLUMN IF NOT EXISTS total_copies INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS available_copies INTEGER DEFAULT 1;

-- Create book copies table for individual copy tracking
CREATE TABLE IF NOT EXISTS book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    school_id BIGINT NOT NULL,
    copy_number VARCHAR(50) NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    qr_code VARCHAR(255),
    condition VARCHAR(50) DEFAULT 'new',
    status VARCHAR(20) DEFAULT 'available', -- available, borrowed, lost, damaged, reserved
    location VARCHAR(100),
    acquired_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_book_copies_book ON book_copies(book_id);
CREATE INDEX idx_book_copies_school ON book_copies(school_id);
CREATE INDEX idx_book_copies_barcode ON book_copies(barcode);
CREATE INDEX idx_book_copies_status ON book_copies(status);

-- Create book circulation table
CREATE TABLE IF NOT EXISTS book_circulation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_copy_id UUID NOT NULL REFERENCES book_copies(id),
    school_id BIGINT NOT NULL,
    student_id UUID REFERENCES students(id),
    teacher_id UUID REFERENCES teachers(id),
    borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    return_date DATE,
    status VARCHAR(20) DEFAULT 'borrowed', -- borrowed, returned, overdue, lost
    fine_amount DECIMAL(10,2) DEFAULT 0,
    fine_paid BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_book_circulation_copy ON book_circulation(book_copy_id);
CREATE INDEX idx_book_circulation_student ON book_circulation(student_id);
CREATE INDEX idx_book_circulation_school ON book_circulation(school_id);
CREATE INDEX idx_book_circulation_status ON book_circulation(status);
CREATE INDEX idx_book_circulation_due_date ON book_circulation(due_date);

-- Create book reservations table
CREATE TABLE IF NOT EXISTS book_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id),
    book_copy_id UUID REFERENCES book_copies(id),
    school_id BIGINT NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id),
    reservation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, fulfilled, cancelled, expired
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_book_reservations_book ON book_reservations(book_id);
CREATE INDEX idx_book_reservations_student ON book_reservations(student_id);
CREATE INDEX idx_book_reservations_school ON book_reservations(school_id);
CREATE INDEX idx_book_reservations_status ON book_reservations(status);
