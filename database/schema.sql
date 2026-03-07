-- EduCore MySQL schema (MySQL 8+)
-- Multi-tenant: each business table includes school_id

CREATE DATABASE IF NOT EXISTS educore_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE educore_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS sms_logs;
DROP TABLE IF EXISTS borrow_records;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS student_transport;
DROP TABLE IF EXISTS transport_routes;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS fee_structure_items;
DROP TABLE IF EXISTS fee_structures;
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS class_subjects;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS timetable_entries;
DROP TABLE IF EXISTS teacher_classes;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS discipline_records;
DROP TABLE IF EXISTS student_guardians;
DROP TABLE IF EXISTS guardians;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS schools;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── Schools ─────────────────────────────────────────────────────────────────
CREATE TABLE schools (
  school_id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name                VARCHAR(160) NOT NULL,
  code                VARCHAR(40)  NOT NULL UNIQUE,
  email               VARCHAR(160) NULL,
  phone               VARCHAR(40)  NULL,
  address             VARCHAR(255) NULL,
  county              VARCHAR(120) NULL,
  country             VARCHAR(120) NOT NULL DEFAULT 'Kenya',
  subscription_status ENUM('active','inactive','trial') NOT NULL DEFAULT 'trial',
  subscription_start  DATE NULL,
  subscription_end    DATE NULL,
  is_deleted          TINYINT(1)   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schools_status  (subscription_status),
  INDEX idx_schools_deleted (is_deleted)
) ENGINE=InnoDB;

-- ─── Users ────────────────────────────────────────────────────────────────────
-- student_id links portal accounts (parent / student) to a specific student row
CREATE TABLE users (
  user_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id      BIGINT UNSIGNED NOT NULL,
  student_id     BIGINT UNSIGNED NULL,                        -- NULL for staff; set for parent/student portal accounts
  full_name      VARCHAR(160) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  phone          VARCHAR(40)  NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('admin','teacher','finance','parent','student') NOT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at  DATETIME NULL,
  is_deleted     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_school_email (school_id, email),
  INDEX idx_users_school_role    (school_id, role),
  INDEX idx_users_school_student (school_id, student_id),
  INDEX idx_users_deleted        (is_deleted),
  CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
) ENGINE=InnoDB;

-- ─── Teachers ────────────────────────────────────────────────────────────────
CREATE TABLE teachers (
  teacher_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id     BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NULL,
  staff_number  VARCHAR(60)  NULL,
  national_id   VARCHAR(40)  NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(160) NULL,
  phone         VARCHAR(40)  NULL,
  hire_date     DATE NULL,
  department    VARCHAR(120) NULL,
  qualification VARCHAR(120) NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teachers_school_staff (school_id, staff_number),
  INDEX idx_teachers_school_status (school_id, status),
  INDEX idx_teachers_deleted       (is_deleted),
  CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_teachers_user   FOREIGN KEY (user_id)   REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ─── Classes ─────────────────────────────────────────────────────────────────
CREATE TABLE classes (
  class_id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id        BIGINT UNSIGNED NOT NULL,
  class_name       VARCHAR(80)  NOT NULL,
  section          VARCHAR(20)  NULL,
  class_teacher_id BIGINT UNSIGNED NULL,
  academic_year    SMALLINT NOT NULL,
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_classes_school_name_section_year (school_id, class_name, section, academic_year),
  INDEX idx_classes_school_status (school_id, status),
  INDEX idx_classes_deleted       (is_deleted),
  CONSTRAINT fk_classes_school  FOREIGN KEY (school_id)        REFERENCES schools(school_id),
  CONSTRAINT fk_classes_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB;

-- ─── Students ────────────────────────────────────────────────────────────────
-- class_name is denormalised for fast queries (kept in sync with classes.class_name)
-- parent_phone is denormalised for easy SMS / child-switcher grouping
CREATE TABLE students (
  student_id       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id        BIGINT UNSIGNED NOT NULL,
  class_id         BIGINT UNSIGNED NULL,
  class_name       VARCHAR(80)  NULL,                         -- denormalised convenience column
  admission_number VARCHAR(60)  NOT NULL,
  first_name       VARCHAR(100) NOT NULL,
  last_name        VARCHAR(100) NOT NULL,
  gender           ENUM('male','female','other') NOT NULL,
  date_of_birth    DATE NULL,
  phone            VARCHAR(40)  NULL,
  email            VARCHAR(160) NULL,
  address          VARCHAR(255) NULL,
  parent_name      VARCHAR(160) NULL,                         -- primary guardian name (convenience)
  parent_phone     VARCHAR(40)  NULL,                         -- primary guardian phone (convenience)
  admission_date   DATE NULL,
  status           ENUM('active','inactive','graduated','transferred') NOT NULL DEFAULT 'active',
  is_deleted       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_school_adm    (school_id, admission_number),
  INDEX idx_students_school_class      (school_id, class_id),
  INDEX idx_students_school_status     (school_id, status),
  INDEX idx_students_parent_phone      (school_id, parent_phone),
  INDEX idx_students_deleted           (is_deleted),
  CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_students_class  FOREIGN KEY (class_id)  REFERENCES classes(class_id)
) ENGINE=InnoDB;

-- ─── Guardians ───────────────────────────────────────────────────────────────
CREATE TABLE guardians (
  guardian_id       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id         BIGINT UNSIGNED NOT NULL,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  relationship_type VARCHAR(40)  NOT NULL,
  phone             VARCHAR(40)  NULL,
  email             VARCHAR(160) NULL,
  occupation        VARCHAR(120) NULL,
  address           VARCHAR(255) NULL,
  is_primary        TINYINT(1)   NOT NULL DEFAULT 0,
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_guardians_school_status (school_id, status),
  INDEX idx_guardians_deleted       (is_deleted),
  CONSTRAINT fk_guardians_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
) ENGINE=InnoDB;

-- ─── Student ↔ Guardian link ──────────────────────────────────────────────────
CREATE TABLE student_guardians (
  id                       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id                BIGINT UNSIGNED NOT NULL,
  student_id               BIGINT UNSIGNED NOT NULL,
  guardian_id              BIGINT UNSIGNED NOT NULL,
  can_pickup               TINYINT(1) NOT NULL DEFAULT 1,
  financial_responsibility TINYINT(1) NOT NULL DEFAULT 0,
  is_deleted               TINYINT(1) NOT NULL DEFAULT 0,
  created_at               TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_guardian          (school_id, student_id, guardian_id),
  INDEX idx_student_guardians_deleted     (is_deleted),
  CONSTRAINT fk_student_guardians_school   FOREIGN KEY (school_id)   REFERENCES schools(school_id),
  CONSTRAINT fk_student_guardians_student  FOREIGN KEY (student_id)  REFERENCES students(student_id),
  CONSTRAINT fk_student_guardians_guardian FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id)
) ENGINE=InnoDB;

-- ─── Discipline ───────────────────────────────────────────────────────────────
CREATE TABLE discipline_records (
  discipline_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id        BIGINT UNSIGNED NOT NULL,
  student_id       BIGINT UNSIGNED NOT NULL,
  teacher_id       BIGINT UNSIGNED NULL,
  incident_type    VARCHAR(120) NOT NULL,
  incident_details TEXT NULL,
  action_taken     TEXT NULL,
  incident_date    DATE NOT NULL,
  status           ENUM('open','closed') NOT NULL DEFAULT 'open',
  is_deleted       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_discipline_school_student (school_id, student_id),
  INDEX idx_discipline_date           (incident_date),
  INDEX idx_discipline_deleted        (is_deleted),
  CONSTRAINT fk_discipline_school  FOREIGN KEY (school_id)  REFERENCES schools(school_id),
  CONSTRAINT fk_discipline_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  CONSTRAINT fk_discipline_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB;

-- ─── Teacher ↔ Class assignments ─────────────────────────────────────────────
CREATE TABLE teacher_classes (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id  BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  class_id   BIGINT UNSIGNED NOT NULL,
  role       ENUM('class_teacher','subject_teacher') NOT NULL DEFAULT 'subject_teacher',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teacher_class_role    (school_id, teacher_id, class_id, role),
  INDEX idx_teacher_classes_deleted   (is_deleted),
  CONSTRAINT fk_teacher_classes_school   FOREIGN KEY (school_id)  REFERENCES schools(school_id),
  CONSTRAINT fk_teacher_classes_teacher  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id),
  CONSTRAINT fk_teacher_classes_class    FOREIGN KEY (class_id)   REFERENCES classes(class_id)
) ENGINE=InnoDB;

-- ─── Timetable ────────────────────────────────────────────────────────────────
CREATE TABLE timetable_entries (
  timetable_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id    BIGINT UNSIGNED NOT NULL,
  class_id     BIGINT UNSIGNED NOT NULL,
  subject_name VARCHAR(120) NOT NULL,
  teacher_id   BIGINT UNSIGNED NULL,
  day_of_week  ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  room         VARCHAR(40) NULL,
  is_deleted   TINYINT(1)  NOT NULL DEFAULT 0,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_timetable_school_class_day (school_id, class_id, day_of_week),
  INDEX idx_timetable_deleted          (is_deleted),
  CONSTRAINT fk_timetable_school  FOREIGN KEY (school_id)  REFERENCES schools(school_id),
  CONSTRAINT fk_timetable_class   FOREIGN KEY (class_id)   REFERENCES classes(class_id),
  CONSTRAINT fk_timetable_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB;

-- ─── Subjects ────────────────────────────────────────────────────────────────
CREATE TABLE subjects (
  subject_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id    BIGINT UNSIGNED NOT NULL,
  subject_name VARCHAR(120) NOT NULL,
  code         VARCHAR(30)  NOT NULL,
  status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subject_school_code     (school_id, code),
  INDEX idx_subjects_school_status      (school_id, status),
  INDEX idx_subjects_deleted            (is_deleted),
  CONSTRAINT fk_subjects_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
) ENGINE=InnoDB;

-- ─── Class ↔ Subject assignments ─────────────────────────────────────────────
CREATE TABLE class_subjects (
  class_subject_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id        BIGINT UNSIGNED NOT NULL,
  class_id         BIGINT UNSIGNED NOT NULL,
  subject_id       BIGINT UNSIGNED NOT NULL,
  teacher_id       BIGINT UNSIGNED NULL,
  is_deleted       TINYINT(1) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_subject_teacher      (school_id, class_id, subject_id, teacher_id),
  INDEX idx_class_subjects_deleted         (is_deleted),
  CONSTRAINT fk_class_subjects_school   FOREIGN KEY (school_id)  REFERENCES schools(school_id),
  CONSTRAINT fk_class_subjects_class    FOREIGN KEY (class_id)   REFERENCES classes(class_id),
  CONSTRAINT fk_class_subjects_subject  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
  CONSTRAINT fk_class_subjects_teacher  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB;

-- ─── Attendance ───────────────────────────────────────────────────────────────
CREATE TABLE attendance (
  attendance_id     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id         BIGINT UNSIGNED NOT NULL,
  student_id        BIGINT UNSIGNED NOT NULL,
  class_id          BIGINT UNSIGNED NOT NULL,
  attendance_date   DATE NOT NULL,
  status            ENUM('present','absent','late') NOT NULL,
  marked_by_user_id BIGINT UNSIGNED NULL,
  remarks           VARCHAR(255) NULL,
  is_deleted        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_student_date      (school_id, student_id, attendance_date),
  INDEX idx_attendance_school_class_date     (school_id, class_id, attendance_date),
  INDEX idx_attendance_deleted               (is_deleted),
  CONSTRAINT fk_attendance_school  FOREIGN KEY (school_id)         REFERENCES schools(school_id),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id)        REFERENCES students(student_id),
  CONSTRAINT fk_attendance_class   FOREIGN KEY (class_id)          REFERENCES classes(class_id),
  CONSTRAINT fk_attendance_marker  FOREIGN KEY (marked_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ─── Exams ────────────────────────────────────────────────────────────────────
CREATE TABLE exams (
  exam_id       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id     BIGINT UNSIGNED NOT NULL,
  exam_name     VARCHAR(120) NOT NULL,
  term          ENUM('Term 1','Term 2','Term 3') NOT NULL,
  academic_year SMALLINT NOT NULL,
  start_date    DATE NULL,
  end_date      DATE NULL,
  status        ENUM('draft','published') NOT NULL DEFAULT 'draft',
  is_deleted    TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_exams_school_term_year (school_id, term, academic_year),
  INDEX idx_exams_deleted          (is_deleted),
  CONSTRAINT fk_exams_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
) ENGINE=InnoDB;

-- ─── Results ─────────────────────────────────────────────────────────────────
CREATE TABLE results (
  result_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id        BIGINT UNSIGNED NOT NULL,
  student_id       BIGINT UNSIGNED NOT NULL,
  subject_id       BIGINT UNSIGNED NOT NULL,
  exam_id          BIGINT UNSIGNED NOT NULL,
  class_id         BIGINT UNSIGNED NOT NULL,
  teacher_id       BIGINT UNSIGNED NULL,
  marks_obtained   DECIMAL(6,2) NOT NULL,
  total_marks      DECIMAL(6,2) NOT NULL,
  grade            VARCHAR(8)   NULL,
  teacher_comment  VARCHAR(255) NULL,
  is_deleted       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_results_student_subject_exam (school_id, student_id, subject_id, exam_id),
  INDEX idx_results_school_class (school_id, class_id),
  INDEX idx_results_deleted      (is_deleted),
  CONSTRAINT fk_results_school   FOREIGN KEY (school_id)  REFERENCES schools(school_id),
  CONSTRAINT fk_results_student  FOREIGN KEY (student_id) REFERENCES students(student_id),
  CONSTRAINT fk_results_subject  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
  CONSTRAINT fk_results_exam     FOREIGN KEY (exam_id)    REFERENCES exams(exam_id),
  CONSTRAINT fk_results_class    FOREIGN KEY (class_id)   REFERENCES classes(class_id),
  CONSTRAINT fk_results_teacher  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB;

-- ─── Fee Structures ───────────────────────────────────────────────────────────
CREATE TABLE fee_structures (
  fee_structure_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id        BIGINT UNSIGNED NOT NULL,
  class_id         BIGINT UNSIGNED NOT NULL,
  class_name       VARCHAR(80) NULL,                          -- denormalised for easy queries
  term             ENUM('Term 1','Term 2','Term 3') NOT NULL,
  academic_year    SMALLINT NOT NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted       TINYINT(1) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fee_structure_class_term_year (school_id, class_id, term, academic_year),
  INDEX idx_fee_structures_deleted            (is_deleted),
  CONSTRAINT fk_fee_structures_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_fee_structures_class  FOREIGN KEY (class_id)  REFERENCES classes(class_id)
) ENGINE=InnoDB;

-- ─── Fee Structure Items ──────────────────────────────────────────────────────
CREATE TABLE fee_structure_items (
  fee_item_id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id        BIGINT UNSIGNED NOT NULL,
  fee_structure_id BIGINT UNSIGNED NOT NULL,
  fee_type         ENUM('tuition','activity','transport','library','misc') NOT NULL,
  amount           DECIMAL(12,2) NOT NULL,
  description      VARCHAR(255) NULL,
  is_deleted       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fee_structure_type   (school_id, fee_structure_id, fee_type),
  INDEX idx_fee_items_deleted        (is_deleted),
  CONSTRAINT fk_fee_items_school     FOREIGN KEY (school_id)        REFERENCES schools(school_id),
  CONSTRAINT fk_fee_items_structure  FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(fee_structure_id)
) ENGINE=InnoDB;

-- ─── Payments ────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  payment_id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id           BIGINT UNSIGNED NOT NULL,
  student_id          BIGINT UNSIGNED NOT NULL,
  fee_structure_id    BIGINT UNSIGNED NULL,
  amount              DECIMAL(12,2) NOT NULL,
  fee_type            ENUM('tuition','activity','transport','library','misc') NOT NULL,
  payment_method      ENUM('mpesa','bank','cash') NOT NULL,
  reference_number    VARCHAR(100) NULL,
  payment_date        DATE NOT NULL,
  status              ENUM('paid','pending','failed','reversed') NOT NULL DEFAULT 'paid',
  received_by_user_id BIGINT UNSIGNED NULL,
  is_deleted          TINYINT(1)   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_school_student_date (school_id, student_id, payment_date),
  INDEX idx_payments_school_status       (school_id, status),
  INDEX idx_payments_reference           (reference_number),
  INDEX idx_payments_deleted             (is_deleted),
  CONSTRAINT fk_payments_school     FOREIGN KEY (school_id)           REFERENCES schools(school_id),
  CONSTRAINT fk_payments_student    FOREIGN KEY (student_id)          REFERENCES students(student_id),
  CONSTRAINT fk_payments_structure  FOREIGN KEY (fee_structure_id)    REFERENCES fee_structures(fee_structure_id),
  CONSTRAINT fk_payments_user       FOREIGN KEY (received_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ─── Transport ────────────────────────────────────────────────────────────────
CREATE TABLE transport_routes (
  transport_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id      BIGINT UNSIGNED NOT NULL,
  route_name     VARCHAR(120) NOT NULL,
  driver_name    VARCHAR(120) NULL,
  driver_phone   VARCHAR(40)  NULL,
  vehicle_number VARCHAR(40)  NULL,
  fee            DECIMAL(12,2) NOT NULL DEFAULT 0,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transport_route_name (school_id, route_name),
  INDEX idx_transport_deleted        (is_deleted),
  CONSTRAINT fk_transport_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
) ENGINE=InnoDB;

-- ─── Student Transport Assignments ───────────────────────────────────────────
CREATE TABLE student_transport (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id    BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NOT NULL,
  transport_id BIGINT UNSIGNED NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NULL,
  status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted   TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_transport_active  (school_id, student_id, transport_id, start_date),
  INDEX idx_student_transport_deleted     (is_deleted),
  CONSTRAINT fk_student_transport_school  FOREIGN KEY (school_id)    REFERENCES schools(school_id),
  CONSTRAINT fk_student_transport_student FOREIGN KEY (student_id)   REFERENCES students(student_id),
  CONSTRAINT fk_student_transport_route   FOREIGN KEY (transport_id) REFERENCES transport_routes(transport_id)
) ENGINE=InnoDB;

-- ─── Library ─────────────────────────────────────────────────────────────────
CREATE TABLE books (
  book_id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id           BIGINT UNSIGNED NOT NULL,
  title               VARCHAR(255) NOT NULL,
  author              VARCHAR(160) NULL,
  category            VARCHAR(100) NULL,
  isbn                VARCHAR(50)  NULL,
  quantity_total      INT NOT NULL DEFAULT 1,
  quantity_available  INT NOT NULL DEFAULT 1,
  status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted          TINYINT(1)   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_books_school_title (school_id, title),
  INDEX idx_books_deleted      (is_deleted),
  CONSTRAINT fk_books_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
) ENGINE=InnoDB;

CREATE TABLE borrow_records (
  borrow_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id   BIGINT UNSIGNED NOT NULL,
  book_id     BIGINT UNSIGNED NOT NULL,
  student_id  BIGINT UNSIGNED NOT NULL,
  borrow_date DATE NOT NULL,
  due_date    DATE NOT NULL,
  return_date DATE NULL,
  status      ENUM('borrowed','returned','overdue') NOT NULL DEFAULT 'borrowed',
  is_deleted  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_borrow_school_status (school_id, status),
  INDEX idx_borrow_deleted       (is_deleted),
  CONSTRAINT fk_borrow_school   FOREIGN KEY (school_id)  REFERENCES schools(school_id),
  CONSTRAINT fk_borrow_book     FOREIGN KEY (book_id)    REFERENCES books(book_id),
  CONSTRAINT fk_borrow_student  FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

-- ─── SMS / Communication Logs ─────────────────────────────────────────────────
CREATE TABLE sms_logs (
  sms_id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id         BIGINT UNSIGNED NOT NULL,
  recipient         VARCHAR(60)  NOT NULL,
  message           TEXT NOT NULL,
  channel           ENUM('sms','email','push') NOT NULL DEFAULT 'sms',
  status            ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  sent_by_user_id   BIGINT UNSIGNED NULL,
  sent_at           DATETIME NULL,
  provider_response TEXT NULL,
  is_deleted        TINYINT(1) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sms_school_status (school_id, status),
  INDEX idx_sms_deleted       (is_deleted),
  CONSTRAINT fk_sms_school FOREIGN KEY (school_id)       REFERENCES schools(school_id),
  CONSTRAINT fk_sms_user   FOREIGN KEY (sent_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ─── Views ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_monthly_fee_collection AS
SELECT school_id,
       DATE_FORMAT(payment_date, '%Y-%m') AS `year_month`,
       SUM(CASE WHEN status = 'paid' AND is_deleted = 0 THEN amount ELSE 0 END) AS total_collected
FROM payments
GROUP BY school_id, DATE_FORMAT(payment_date, '%Y-%m');

CREATE OR REPLACE VIEW v_attendance_rate AS
SELECT school_id,
       attendance_date,
       ROUND(100 * AVG(CASE WHEN status = 'present' THEN 1 ELSE 0 END), 2) AS attendance_rate_pct
FROM attendance
WHERE is_deleted = 0
GROUP BY school_id, attendance_date;

CREATE OR REPLACE VIEW v_fee_defaulters AS
SELECT s.school_id,
       s.student_id,
       s.admission_number,
       CONCAT(s.first_name, ' ', s.last_name) AS student_name,
       COALESCE(s.class_name, c.class_name)   AS class_name,
       s.parent_phone,
       COALESCE(fs_total.expected_total, 0)   AS expected_total,
       COALESCE(paid_total.paid_total, 0)     AS paid_total,
       GREATEST(COALESCE(fs_total.expected_total, 0) - COALESCE(paid_total.paid_total, 0), 0) AS balance_due
FROM students s
LEFT JOIN classes c ON c.class_id = s.class_id
LEFT JOIN (
    SELECT f.school_id, f.class_id, SUM(i.amount) AS expected_total
    FROM fee_structures f
    JOIN fee_structure_items i ON i.fee_structure_id = f.fee_structure_id
    WHERE f.is_deleted = 0 AND i.is_deleted = 0 AND f.is_active = 1
    GROUP BY f.school_id, f.class_id
) fs_total ON fs_total.school_id = s.school_id AND fs_total.class_id = s.class_id
LEFT JOIN (
    SELECT school_id, student_id, SUM(amount) AS paid_total
    FROM payments
    WHERE status = 'paid' AND is_deleted = 0
    GROUP BY school_id, student_id
) paid_total ON paid_total.school_id = s.school_id AND paid_total.student_id = s.student_id
WHERE s.is_deleted = 0;