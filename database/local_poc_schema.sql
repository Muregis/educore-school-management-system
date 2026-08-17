-- EduCore Attendance Offline POC - Local PostgreSQL Schema
-- Database: educore_attendance_poc
-- This schema contains ONLY the minimum tables required for Attendance to function locally.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools
CREATE TABLE IF NOT EXISTS schools (
  school_id           BIGSERIAL PRIMARY KEY,
  name                VARCHAR(160) NOT NULL,
  code                VARCHAR(40)  NOT NULL UNIQUE,
  email               VARCHAR(160) NULL,
  phone               VARCHAR(40)  NULL,
  address             VARCHAR(255) NULL,
  county              VARCHAR(120) NULL,
  country             VARCHAR(120) NOT NULL DEFAULT 'Kenya',
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial',
  subscription_start  DATE NULL,
  subscription_end    DATE NULL,
  is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id        BIGSERIAL PRIMARY KEY,
  school_id      BIGINT NOT NULL REFERENCES schools(school_id),
  student_id     BIGINT NULL,
  full_name      VARCHAR(160) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  phone          VARCHAR(40)  NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login_at  TIMESTAMP NULL,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, email)
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  class_id         BIGSERIAL PRIMARY KEY,
  school_id        BIGINT NOT NULL REFERENCES schools(school_id),
  class_name       VARCHAR(80)  NOT NULL,
  section          VARCHAR(20)  NULL,
  class_teacher_id BIGINT NULL,
  academic_year    SMALLINT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_name, section, academic_year)
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  student_id       BIGSERIAL PRIMARY KEY,
  school_id        BIGINT NOT NULL REFERENCES schools(school_id),
  class_id         BIGINT NULL REFERENCES classes(class_id),
  class_name       VARCHAR(80)  NULL,
  admission_number VARCHAR(60)  NOT NULL,
  first_name       VARCHAR(100) NOT NULL,
  last_name        VARCHAR(100) NOT NULL,
  gender           VARCHAR(20) NOT NULL,
  date_of_birth    DATE NULL,
  phone            VARCHAR(40)  NULL,
  email            VARCHAR(160) NULL,
  address          VARCHAR(255) NULL,
  parent_name      VARCHAR(160) NULL,
  parent_phone     VARCHAR(40)  NULL,
  admission_date   DATE NULL,
  photo_url        TEXT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, admission_number)
);

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
  teacher_id    BIGSERIAL PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(school_id),
  user_id       BIGINT NULL REFERENCES users(user_id),
  staff_number  VARCHAR(60)  NULL,
  national_id   VARCHAR(40)  NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(160) NULL,
  phone         VARCHAR(40)  NULL,
  hire_date     DATE NULL,
  department    VARCHAR(120) NULL,
  qualification VARCHAR(120) NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, staff_number)
);

-- Teacher Class Assignments
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  assignment_id BIGSERIAL PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(school_id),
  teacher_id    BIGINT NOT NULL REFERENCES users(user_id),
  class_id      BIGINT REFERENCES classes(class_id),
  class_name    VARCHAR(80) NOT NULL,
  subject_id    BIGINT NULL,
  subject_name  VARCHAR(100),
  is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  academic_year VARCHAR(10),
  term          VARCHAR(50),
  assigned_by   BIGINT REFERENCES users(user_id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tca_school_teacher 
  ON teacher_class_assignments(school_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_tca_school_class 
  ON teacher_class_assignments(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_tca_active 
  ON teacher_class_assignments(is_active);

-- Attendance
CREATE TYPE IF NOT EXISTS attendance_status AS ENUM ('present','absent','late');

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id     BIGSERIAL PRIMARY KEY,
  school_id         BIGINT NOT NULL REFERENCES schools(school_id),
  student_id        BIGINT NOT NULL REFERENCES students(student_id),
  class_id          BIGINT NOT NULL REFERENCES classes(class_id),
  attendance_date   DATE NOT NULL,
  status            attendance_status NOT NULL,
  marked_by_user_id BIGINT NULL REFERENCES users(user_id),
  remarks           VARCHAR(255) NULL,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_student_date
  ON attendance (school_id, student_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_school_class_date
  ON attendance (school_id, class_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_deleted
  ON attendance (is_deleted);

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  device_name TEXT,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions(user_id, session_id)
  WHERE is_active = true;

-- Audit logs (for future sync)
CREATE TABLE IF NOT EXISTS activity_logs (
  log_id      BIGSERIAL PRIMARY KEY,
  school_id   BIGINT NOT NULL,
  user_id     BIGINT NULL,
  role        VARCHAR(30) NULL,
  action      VARCHAR(80) NOT NULL,
  entity      VARCHAR(60) NULL,
  entity_id   BIGINT NULL,
  description VARCHAR(255) NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_school_created
  ON activity_logs (school_id, created_at);
