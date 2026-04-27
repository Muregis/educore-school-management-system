-- Migration: Create student_services for optional services (lunch, transport)
-- Tracks which students are enrolled in optional services

CREATE TABLE IF NOT EXISTS student_services (
  service_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  student_id BIGINT NOT NULL REFERENCES students(student_id),
  service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('lunch', 'transport')),
  transport_direction VARCHAR(10) CHECK (transport_direction IN ('one_way', 'two_way', 'none')),
  lunch_days_per_week INT DEFAULT 5,
  daily_rate DECIMAL(8,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, student_id, service_type, start_date)
);

CREATE INDEX IF NOT EXISTS idx_student_services_school ON student_services(school_id);
CREATE INDEX IF NOT EXISTS idx_student_services_student ON student_services(student_id);
CREATE INDEX IF NOT EXISTS idx_student_services_active ON student_services(service_type, is_active);

-- RLS for tenant isolation
ALTER TABLE student_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_services_school_isolation ON student_services
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_student_service_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_service_timestamp_trigger
  BEFORE UPDATE ON student_services
  FOR EACH ROW
  EXECUTE FUNCTION update_student_service_timestamp();

COMMENT ON TABLE student_services IS 'Student optional services enrollment (lunch, transport)';
COMMENT ON COLUMN student_services.transport_direction IS 'For transport: one_way, two_way, none';
COMMENT ON COLUMN student_services.daily_rate IS 'Daily cost for the service';
