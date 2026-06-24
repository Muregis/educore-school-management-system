-- Normalize guardian records
BEGIN;

-- Create dedicated guardians table if not exists
CREATE TABLE IF NOT EXISTS guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    relationship VARCHAR(50),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_guardians_school ON guardians(school_id);
CREATE INDEX idx_guardians_email ON guardians(email) WHERE email IS NOT NULL;

-- Backfill guardians from students table
INSERT INTO guardians (school_id, first_name, last_name, email, phone, relationship)
SELECT DISTINCT 
    school_id, 
    COALESCE(guardian_first_name, 'Unknown'),
    COALESCE(guardian_last_name, 'Unknown'),
    guardian_email,
    guardian_phone,
    'Parent'
FROM students 
WHERE guardian_first_name IS NOT NULL OR guardian_last_name IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
