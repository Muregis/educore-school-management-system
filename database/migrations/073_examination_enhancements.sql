-- Phase 6: Examinations
-- Enhance exam tables for enterprise features

-- Add exam scheduling fields
ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS exam_date DATE,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS venue VARCHAR(200),
ADD COLUMN IF NOT EXISTS invigilator_id UUID REFERENCES teachers(id),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
ADD COLUMN IF NOT EXISTS total_marks INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS passing_marks INTEGER DEFAULT 50;

-- Add exam result history tracking
ALTER TABLE exam_results
ADD COLUMN IF NOT EXISTS grade VARCHAR(10),
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS verified_by UUID,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

-- Create exam schedules table
CREATE TABLE IF NOT EXISTS exam_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    exam_id UUID NOT NULL REFERENCES exams(id),
    class_id UUID REFERENCES classes(id),
    stream_id UUID REFERENCES streams(id),
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exam_schedules_school ON exam_schedules(school_id);
CREATE INDEX idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX idx_exam_schedules_class ON exam_schedules(class_id);
