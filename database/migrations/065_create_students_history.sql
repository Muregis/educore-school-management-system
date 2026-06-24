-- Create students_history table
CREATE TABLE IF NOT EXISTS students_history (
    history_id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL,
    school_id BIGINT NOT NULL,
    operation VARCHAR(10) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER NOT NULL,
    reason TEXT
);

CREATE INDEX idx_students_history_student ON students_history(student_id);
CREATE INDEX idx_students_history_school ON students_history(school_id);
