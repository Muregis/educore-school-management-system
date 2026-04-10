-- ============================================
-- EduCore Database Migration - All Tables
-- ============================================

-- Schools table (if not exists)
CREATE TABLE IF NOT EXISTS schools (
  school_id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(160),
  phone VARCHAR(40),
  address VARCHAR(255),
  county VARCHAR(120),
  country VARCHAR(120) DEFAULT 'Kenya',
  subscription_status VARCHAR(20) DEFAULT 'trial',
  subscription_start DATE,
  subscription_end DATE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('admin','teacher','finance','hr','librarian','parent','student')),
  status VARCHAR(20) DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  student_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  class_id BIGINT,
  class_name VARCHAR(80),
  admission_number VARCHAR(60) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  gender VARCHAR(20) CHECK (gender IN ('male','female','other')),
  date_of_birth DATE,
  nemis_number VARCHAR(40),
  phone VARCHAR(40),
  email VARCHAR(160),
  address VARCHAR(255),
  parent_name VARCHAR(160),
  parent_phone VARCHAR(40),
  blood_group VARCHAR(10),
  allergies TEXT,
  medical_conditions TEXT,
  emergency_contact_name VARCHAR(160),
  emergency_contact_phone VARCHAR(40),
  emergency_contact_relationship VARCHAR(50),
  admission_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  teacher_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  user_id BIGINT REFERENCES users(user_id),
  staff_number VARCHAR(60),
  tsc_staff_id VARCHAR(60),
  national_id VARCHAR(40),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(160),
  phone VARCHAR(40),
  hire_date DATE,
  department VARCHAR(120),
  qualification VARCHAR(120),
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  class_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  class_name VARCHAR(80) NOT NULL,
  section VARCHAR(20),
  class_teacher_id BIGINT REFERENCES teachers(teacher_id),
  academic_year SMALLINT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  subject_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  category VARCHAR(50),
  description TEXT,
  class_levels VARCHAR(255),
  max_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 40,
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Results table
CREATE TABLE IF NOT EXISTS results (
  result_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  subject VARCHAR(100) NOT NULL,
  marks NUMERIC(8,2),
  total_marks INTEGER DEFAULT 100,
  grade VARCHAR(5),
  term VARCHAR(40),
  exam_type VARCHAR(40),
  teacher_comment TEXT,
  teacher_id BIGINT REFERENCES teachers(teacher_id),
  academic_year VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  date DATE NOT NULL,
  status VARCHAR(20) CHECK (status IN ('present','absent','late','excused')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  payment_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(40),
  reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
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
  academic_year VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report cards table
CREATE TABLE IF NOT EXISTS report_cards (
  report_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  term VARCHAR(40) DEFAULT 'Term 2',
  academic_year VARCHAR(20) DEFAULT '2026',
  class_name VARCHAR(60),
  total_marks NUMERIC(8,2) DEFAULT 0,
  average NUMERIC(5,2) DEFAULT 0,
  class_position INTEGER,
  out_of INTEGER,
  class_teacher_comment TEXT,
  principal_comment TEXT,
  conduct VARCHAR(40) DEFAULT 'Good',
  days_present INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by VARCHAR(160),
  approved_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical records table
CREATE TABLE IF NOT EXISTS medical_records (
  record_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  record_type VARCHAR(50),
  record_date DATE DEFAULT CURRENT_DATE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  details JSONB,
  documented_by VARCHAR(160),
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transport tables
CREATE TABLE IF NOT EXISTS transport_routes (
  transport_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  route_name VARCHAR(100) NOT NULL,
  driver_name VARCHAR(100),
  vehicle_number VARCHAR(40),
  fee NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_transport (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  transport_id BIGINT REFERENCES transport_routes(transport_id),
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- M-Pesa tables
CREATE TABLE IF NOT EXISTS mpesa_reconciliation_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  action VARCHAR(100),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mpesa_unmatched (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  transaction_id VARCHAR(100),
  amount DECIMAL(12,2),
  phone VARCHAR(40),
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HR tables
CREATE TABLE IF NOT EXISTS hr_staff (
  staff_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(160),
  phone VARCHAR(40),
  department VARCHAR(120),
  job_title VARCHAR(120),
  contract_type VARCHAR(40),
  start_date DATE,
  salary NUMERIC(12,2),
  status VARCHAR(20) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_attendance (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  staff_id BIGINT REFERENCES hr_staff(staff_id),
  attendance_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'present',
  check_in TIME,
  check_out TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Library tables
CREATE TABLE IF NOT EXISTS books (
  book_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  title VARCHAR(200) NOT NULL,
  author VARCHAR(160),
  isbn VARCHAR(40),
  category VARCHAR(80),
  copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS borrow_records (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  book_id BIGINT REFERENCES books(book_id),
  borrow_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE,
  status VARCHAR(20) DEFAULT 'borrowed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  announcement_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  title VARCHAR(200) NOT NULL,
  message TEXT,
  target_roles VARCHAR(200),
  created_by BIGINT REFERENCES users(user_id),
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS Logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  recipient VARCHAR(40),
  message TEXT,
  channel VARCHAR(20),
  status VARCHAR(20),
  sent_by_user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discipline records table
CREATE TABLE IF NOT EXISTS discipline_records (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  incident_date DATE,
  incident_type VARCHAR(100),
  description TEXT,
  action_taken TEXT,
  recorded_by BIGINT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lesson plans table
CREATE TABLE IF NOT EXISTS lesson_plans (
  plan_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  teacher_id BIGINT REFERENCES teachers(teacher_id),
  subject VARCHAR(100),
  class_name VARCHAR(80),
  topic VARCHAR(200),
  objectives TEXT,
  activities TEXT,
  week_number INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  student_id BIGINT REFERENCES students(student_id),
  invoice_number VARCHAR(40),
  amount NUMERIC(12,2),
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable table
CREATE TABLE IF NOT EXISTS timetable_entries (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  class_name VARCHAR(80),
  subject VARCHAR(100),
  teacher_id BIGINT REFERENCES teachers(teacher_id),
  day_of_week VARCHAR(20),
  start_time TIME,
  end_time TIME,
  academic_year VARCHAR(20),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  exam_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  exam_name VARCHAR(100) NOT NULL,
  class_name VARCHAR(80),
  term VARCHAR(40),
  academic_year VARCHAR(20),
  start_date DATE,
  end_date DATE,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id),
  user_id BIGINT REFERENCES users(user_id),
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(school_id, class_name);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_term ON results(term);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_student ON report_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_student ON medical_records(student_id);