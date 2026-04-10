-- Complete database migration for all missing tables
-- Run this in Supabase SQL Editor

-- Schools table (base)
CREATE TABLE IF NOT EXISTS schools (
  school_id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(160),
  phone VARCHAR(40),
  address VARCHAR(255),
  county VARCHAR(120),
  country VARCHAR(120) DEFAULT 'Kenya',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  subject_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  name VARCHAR(100),
  code VARCHAR(20),
  category VARCHAR(50),
  description TEXT,
  class_levels VARCHAR(255),
  max_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 40,
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  student_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  gender VARCHAR(20),
  class_name VARCHAR(80),
  admission_number VARCHAR(60),
  parent_name VARCHAR(160),
  parent_phone VARCHAR(40),
  blood_group VARCHAR(10),
  allergies TEXT,
  medical_conditions TEXT,
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Exams table (matches backend route)
CREATE TABLE IF NOT EXISTS exams (
  exam_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  name VARCHAR(120) NOT NULL,
  exam_type VARCHAR(50) DEFAULT 'internal',
  term VARCHAR(40) NOT NULL,
  year SMALLINT NOT NULL,
  start_date DATE,
  end_date DATE,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- M-Pesa unmatched table
CREATE TABLE IF NOT EXISTS mpesa_unmatched (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  transaction_id VARCHAR(100),
  amount DECIMAL(12,2),
  phone VARCHAR(40),
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  matched_student_id BIGINT,
  matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- M-Pesa reconciliation logs
CREATE TABLE IF NOT EXISTS mpesa_reconciliation_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  unmatched_id BIGINT,
  student_id BIGINT,
  payment_id BIGINT,
  action VARCHAR(100),
  performed_by BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  payment_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  amount NUMERIC(12,2),
  payment_method VARCHAR(40),
  reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  term VARCHAR(40),
  academic_year VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee structures table
CREATE TABLE IF NOT EXISTS fee_structures (
  fee_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  class_name VARCHAR(80),
  tuition NUMERIC(12,2),
  activity NUMERIC(12,2),
  misc NUMERIC(12,2),
  term VARCHAR(40),
  academic_year VARCHAR(20)
);

-- Results table
CREATE TABLE IF NOT EXISTS results (
  result_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  subject VARCHAR(100),
  marks NUMERIC(8,2),
  total_marks INTEGER DEFAULT 100,
  grade VARCHAR(5),
  term VARCHAR(40),
  teacher_comment TEXT,
  academic_year VARCHAR(20)
);

-- Report cards table
CREATE TABLE IF NOT EXISTS report_cards (
  report_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  term VARCHAR(40),
  academic_year VARCHAR(20),
  is_published BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Medical records table
CREATE TABLE IF NOT EXISTS medical_records (
  record_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  record_type VARCHAR(50),
  record_date DATE DEFAULT CURRENT_DATE,
  title VARCHAR(200),
  description TEXT,
  documented_by VARCHAR(160),
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transport routes table
CREATE TABLE IF NOT EXISTS transport_routes (
  transport_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  route_name VARCHAR(100),
  driver_name VARCHAR(100),
  vehicle_number VARCHAR(40),
  fee NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Student transport table
CREATE TABLE IF NOT EXISTS student_transport (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  transport_id BIGINT REFERENCES transport_routes(transport_id),
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE
);