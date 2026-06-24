-- Phase 4: Student Lifecycle
-- Create tables for permanent student record management

-- Student enrollments table (tracks enrollment history)
CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id BIGINT NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id),
    term_id UUID REFERENCES terms(id),
    class_id UUID REFERENCES classes(id),
    stream_id UUID REFERENCES streams(id),
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    enrollment_status VARCHAR(50) DEFAULT 'active', -- active, transferred, graduated, withdrawn, suspended
    exit_date DATE,
    exit_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX idx_student_enrollments_school ON student_enrollments(school_id);
CREATE INDEX idx_student_enrollments_academic_year ON student_enrollments(academic_year_id);
CREATE INDEX idx_student_enrollments_class ON student_enrollments(class_id);

-- Student status history table
CREATE TABLE IF NOT EXISTS student_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    reason TEXT,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_status_history_student ON student_status_history(student_id);
CREATE INDEX idx_student_status_history_school ON student_status_history(school_id);

-- Alumni table
CREATE TABLE IF NOT EXISTS alumni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id BIGINT NOT NULL,
    graduation_date DATE NOT NULL,
    final_class_id UUID REFERENCES classes(id),
    final_stream_id UUID REFERENCES streams(id),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    current_occupation TEXT,
    current_institution TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alumni_student ON alumni(student_id);
CREATE INDEX idx_alumni_school ON alumni(school_id);
CREATE INDEX idx_alumni_graduation ON alumni(graduation_date);
