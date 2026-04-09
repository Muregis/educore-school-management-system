-- Migration: Add exams and exam results tables
-- For exam scheduling, management, and results

CREATE TABLE IF NOT EXISTS exams (
  exam_id         BIGSERIAL PRIMARY KEY,
  school_id       BIGINT NOT NULL REFERENCES schools(school_id),
  name            VARCHAR(160) NOT NULL,
  exam_type       VARCHAR(40) NOT NULL DEFAULT 'internal', -- internal, midterm, endterm, KCPE, KCSE
  term            VARCHAR(20) NOT NULL,
  year            INTEGER NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, active, completed, published
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_school ON exams(school_id, year, term);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(school_id, status);

COMMENT ON TABLE exams IS 'Exam scheduling and management (internal exams, KCPE, KCSE)';

-- Exam schedule (which subjects on which days)
CREATE TABLE IF NOT EXISTS exam_schedules (
  schedule_id     BIGSERIAL PRIMARY KEY,
  exam_id         BIGINT NOT NULL REFERENCES exams(exam_id),
  subject_id      BIGINT NOT NULL REFERENCES subjects(subject_id),
  class_name      VARCHAR(80) NOT NULL,
  exam_date       DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  venue           VARCHAR(100),
  max_marks       INTEGER NOT NULL DEFAULT 100,
  instructions    TEXT,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(exam_id, subject_id, class_name)
);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_class ON exam_schedules(class_name, exam_date);

-- Exam results (student scores)
CREATE TABLE IF NOT EXISTS exam_results (
  result_id       BIGSERIAL PRIMARY KEY,
  exam_id         BIGINT NOT NULL REFERENCES exams(exam_id),
  student_id      BIGINT NOT NULL REFERENCES students(student_id),
  subject_id      BIGINT NOT NULL REFERENCES subjects(subject_id),
  schedule_id     BIGINT REFERENCES exam_schedules(schedule_id),
  marks           NUMERIC(6,2),
  grade           VARCHAR(10),
  remarks         VARCHAR(255),
  position        INTEGER, -- class position in this subject
  is_absent       BOOLEAN NOT NULL DEFAULT FALSE,
  entered_by      BIGINT REFERENCES users(user_id),
  entered_at      TIMESTAMP WITH TIME ZONE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id, exam_id);

COMMENT ON TABLE exam_results IS 'Student marks for each exam and subject';

-- Grade boundaries per school
CREATE TABLE IF NOT EXISTS grade_boundaries (
  boundary_id     BIGSERIAL PRIMARY KEY,
  school_id       BIGINT NOT NULL REFERENCES schools(school_id),
  exam_type       VARCHAR(40) NOT NULL,
  grade           VARCHAR(10) NOT NULL,
  min_score       NUMERIC(5,2) NOT NULL,
  max_score       NUMERIC(5,2) NOT NULL,
  description     VARCHAR(100),
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(school_id, exam_type, grade)
);

-- Default Kenyan grading system
INSERT INTO grade_boundaries (school_id, exam_type, grade, min_score, max_score, description) VALUES
  (1, 'internal', 'A', 80, 100, 'Excellent'),
  (1, 'internal', 'B', 70, 79, 'Very Good'),
  (1, 'internal', 'C', 60, 69, 'Good'),
  (1, 'internal', 'D', 50, 59, 'Average'),
  (1, 'internal', 'E', 40, 49, 'Below Average'),
  (1, 'internal', 'F', 0, 39, 'Fail')
ON CONFLICT DO NOTHING;

SELECT 'Exam management tables created successfully' AS status;
