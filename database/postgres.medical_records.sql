-- Medical Records table for student health information
CREATE TABLE IF NOT EXISTS medical_records (
  record_id         BIGSERIAL PRIMARY KEY,
  school_id         BIGINT NOT NULL REFERENCES schools(school_id),
  student_id        BIGINT NOT NULL REFERENCES students(student_id),
  record_type       VARCHAR(50) NOT NULL CHECK (record_type IN ('clinic_visit','vaccination','health_checkup','medication','allergy','medical_history','consent')),
  record_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  title             VARCHAR(200) NOT NULL,
  description       TEXT NULL,
  details           JSONB NULL,
  documented_by    VARCHAR(160) NULL,
  follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_date    DATE NULL,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_school ON medical_records(school_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_student ON medical_records(student_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records(record_type);
CREATE INDEX IF NOT EXISTS idx_medical_records_date ON medical_records(record_date);