-- EduCore PostgreSQL Schema for Supabase
-- This schema should match your Supabase database structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  school_id           BIGSERIAL PRIMARY KEY,
  name                VARCHAR(160) NOT NULL,
  code                VARCHAR(40)  NOT NULL UNIQUE,
  email               VARCHAR(160) NULL,
  phone               VARCHAR(40)  NULL,
  address             VARCHAR(255) NULL,
  county              VARCHAR(120) NULL,
  country             VARCHAR(120) NOT NULL DEFAULT 'Kenya',
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('active','inactive','trial')),
  subscription_start  DATE NULL,
  subscription_end    DATE NULL,
  is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Users table (for staff, parents, students login)
CREATE TABLE IF NOT EXISTS users (
  user_id        BIGSERIAL PRIMARY KEY,
  school_id      BIGINT NOT NULL REFERENCES schools(school_id),
  student_id     BIGINT NULL,
  full_name      VARCHAR(160) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  phone          VARCHAR(40)  NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20) NOT NULL CHECK (role IN ('admin','teacher','finance','hr','librarian','parent','student')),
  status         VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  last_login_at  TIMESTAMP WITH TIME ZONE NULL,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, email)
);

-- Add foreign key for student_id after users table exists
ALTER TABLE users ADD CONSTRAINT fk_users_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE SET NULL;

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  teacher_id    BIGSERIAL PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(school_id),
  user_id       BIGINT NULL REFERENCES users(user_id),
  staff_number  VARCHAR(60)  NULL,
  tsc_staff_id  VARCHAR(60)  NULL,
  national_id   VARCHAR(40)  NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(160) NULL,
  phone         VARCHAR(40)  NULL,
  hire_date     DATE NULL,
  department    VARCHAR(120) NULL,
  qualification VARCHAR(120) NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, staff_number)
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  class_id         BIGSERIAL PRIMARY KEY,
  school_id        BIGINT NOT NULL REFERENCES schools(school_id),
  class_name       VARCHAR(80)  NOT NULL,
  section          VARCHAR(20)  NULL,
  class_teacher_id BIGINT NULL REFERENCES teachers(teacher_id),
  academic_year    SMALLINT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_name, section, academic_year)
);

-- STUDENTS TABLE - With all required fields
CREATE TABLE IF NOT EXISTS students (
  student_id       BIGSERIAL PRIMARY KEY,
  school_id        BIGINT NOT NULL REFERENCES schools(school_id),
  class_id         BIGINT NULL REFERENCES classes(class_id),
  class_name       VARCHAR(80)  NULL,
  admission_number VARCHAR(60)  NOT NULL,
  first_name       VARCHAR(100) NOT NULL,
  last_name        VARCHAR(100) NOT NULL,
  gender           VARCHAR(20) NOT NULL CHECK (gender IN ('male','female','other')),
  date_of_birth    DATE NULL,
  nemis_number     VARCHAR(40)  NULL,
  phone            VARCHAR(40)  NULL,
  email            VARCHAR(160) NULL,
  address          VARCHAR(255) NULL,
  parent_name      VARCHAR(160) NULL,
  parent_phone     VARCHAR(40)  NULL,
  admission_date   DATE NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated','transferred')),
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, admission_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_students_school_status ON students(school_id, status);
CREATE INDEX IF NOT EXISTS idx_students_parent_phone ON students(school_id, parent_phone);
CREATE INDEX IF NOT EXISTS idx_students_deleted ON students(is_deleted);
CREATE INDEX IF NOT EXISTS idx_students_class_name ON students(school_id, class_name);

-- Guardians table (separate from parent users)
CREATE TABLE IF NOT EXISTS guardians (
  guardian_id       BIGSERIAL PRIMARY KEY,
  school_id         BIGINT NOT NULL REFERENCES schools(school_id),
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  relationship_type VARCHAR(40)  NOT NULL,
  phone             VARCHAR(40)  NULL,
  email             VARCHAR(160) NULL,
  occupation        VARCHAR(120) NULL,
  address           VARCHAR(255) NULL,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Student to Guardian link
CREATE TABLE IF NOT EXISTS student_guardians (
  id                       BIGSERIAL PRIMARY KEY,
  school_id                BIGINT NOT NULL REFERENCES schools(school_id),
  student_id               BIGINT NOT NULL REFERENCES students(student_id),
  guardian_id              BIGINT NOT NULL REFERENCES guardians(guardian_id),
  can_pickup               BOOLEAN NOT NULL DEFAULT TRUE,
  financial_responsibility BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, student_id, guardian_id)
);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guardians_updated_at BEFORE UPDATE ON guardians FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_guardians_updated_at BEFORE UPDATE ON student_guardians FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies for multi-tenancy
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own school's data
CREATE POLICY school_isolation ON schools USING (school_id = current_setting('app.current_school_id')::BIGINT);
CREATE POLICY user_isolation ON users USING (school_id = current_setting('app.current_school_id')::BIGINT);
CREATE POLICY teacher_isolation ON teachers USING (school_id = current_setting('app.current_school_id')::BIGINT);
CREATE POLICY class_isolation ON classes USING (school_id = current_setting('app.current_school_id')::BIGINT);
CREATE POLICY student_isolation ON students USING (school_id = current_setting('app.current_school_id')::BIGINT);
CREATE POLICY guardian_isolation ON guardians USING (school_id = current_setting('app.current_school_id')::BIGINT);
CREATE POLICY student_guardian_isolation ON student_guardians USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Insert default school (for testing)
INSERT INTO schools (name, code, country) VALUES 
  ('Demo School', 'DEMO001', 'Kenya')
ON CONFLICT (code) DO NOTHING;

SELECT 'EduCore PostgreSQL schema loaded successfully' AS status;
