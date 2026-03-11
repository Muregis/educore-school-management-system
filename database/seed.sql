USE educore_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE sms_logs;
TRUNCATE TABLE borrow_records;
TRUNCATE TABLE books;
TRUNCATE TABLE student_transport;
TRUNCATE TABLE transport_routes;
TRUNCATE TABLE payments;
TRUNCATE TABLE fee_structures;
TRUNCATE TABLE results;
TRUNCATE TABLE exams;
TRUNCATE TABLE attendance;
TRUNCATE TABLE class_subjects;
TRUNCATE TABLE subjects;
TRUNCATE TABLE timetable_entries;
TRUNCATE TABLE teacher_classes;
TRUNCATE TABLE discipline_records;
TRUNCATE TABLE student_guardians;
TRUNCATE TABLE guardians;
TRUNCATE TABLE students;
TRUNCATE TABLE classes;
TRUNCATE TABLE teachers;
TRUNCATE TABLE users;
TRUNCATE TABLE hr_leave;
TRUNCATE TABLE hr_staff;
TRUNCATE TABLE admissions;
TRUNCATE TABLE notifications;
TRUNCATE TABLE report_cards;
TRUNCATE TABLE invoices;
TRUNCATE TABLE schools;
SET FOREIGN_KEY_CHECKS = 1;

-- School 
INSERT INTO schools (school_id, name, code, email, phone, address, county, subscription_status, subscription_start, subscription_end)
VALUES (1, 'Greenfield Academy', 'GFA-001', 'admin@greenfield.ac.ke', '+254712345678', '123 Ngong Road, Nairobi', 'Nairobi', 'active', '2026-01-01', '2026-12-31');

-- Staff Users 
-- Passwords: admin123 / teacher123 / finance123 / hr123
INSERT INTO users (user_id, school_id, student_id, full_name, email, phone, password_hash, role, status)
VALUES
(1, 1, NULL, 'Mrs. Wanjiku',   'admin@greenfield.ac.ke',   '+254712345678', '$2b$10$placeholder_admin_hash',   'admin',   'active'),
(2, 1, NULL, 'Grace Akinyi',   'teacher@greenfield.ac.ke', '+254711222333', '$2b$10$placeholder_teacher_hash', 'teacher', 'active'),
(3, 1, NULL, 'Peter Maina',    'finance@greenfield.ac.ke', '+254733444555', '$2b$10$placeholder_finance_hash', 'finance', 'active'),
(12, 1, NULL, 'Jane Otieno',   'hr@greenfield.ac.ke',      '+254755666777', '$2b$10$placeholder_hr_hash',      'hr',        'active'),
(13, 1, NULL, 'Mary Njoroge',  'librarian@greenfield.ac.ke','+254766777888', '$2b$10$placeholder_librarian_hash', 'librarian', 'active');

-- Teachers 
INSERT INTO teachers (teacher_id, school_id, user_id, staff_number, national_id, first_name, last_name, email, phone, hire_date, department, qualification, status)
VALUES
(1, 1, 2,    'T-0001', '12345678', 'Grace', 'Akinyi', 'teacher@greenfield.ac.ke',    '+254711222333', '2024-01-15', 'Sciences',  'B.Ed Mathematics', 'active'),
(2, 1, NULL, 'T-0002', '23456789', 'James', 'Mwangi', 'j.mwangi@greenfield.ac.ke',  '+254722333444', '2023-09-01', 'Languages', 'BA Education',      'active');

-- Classes 
INSERT INTO classes (class_id, school_id, class_name, section, class_teacher_id, academic_year, status)
VALUES
(1, 1, 'Grade 5', 'A', 2,    2026, 'active'),
(2, 1, 'Grade 6', 'A', 2,    2026, 'active'),
(3, 1, 'Grade 7', 'A', 1,    2026, 'active'),
(4, 1, 'Grade 8', 'A', NULL, 2026, 'active');

-- Students 
INSERT INTO students (student_id, school_id, class_id, class_name, admission_number, first_name, last_name, gender, date_of_birth, parent_name, parent_phone, admission_date, status)
VALUES
(1, 1, 3, 'Grade 7', 'ADM-2020-001', 'Amara', 'Osei',  'female', '2012-03-14', 'Mr. Kofi Osei',   '0712345678', '2020-01-10', 'active'),
(2, 1, 4, 'Grade 8', 'ADM-2019-002', 'Brian', 'Kamau', 'male',   '2011-07-22', 'Mrs. Mary Kamau', '0723456789', '2019-01-15', 'active'),
(3, 1, 2, 'Grade 6', 'ADM-2021-003', 'Chloe', 'Mutua', 'female', '2013-01-05', 'Mr. Peter Mutua', '0734567890', '2021-01-12', 'active'),
(4, 1, 1, 'Grade 5', 'ADM-2022-004', 'Kevin', 'Osei',  'male',   '2014-06-10', 'Mr. Kofi Osei',   '0712345678', '2022-01-10', 'active');

-- Guardians 
INSERT INTO guardians (guardian_id, school_id, first_name, last_name, relationship_type, phone, email, occupation, address, is_primary, status)
VALUES
(1, 1, 'Kofi',  'Osei',  'father', '0712345678', 'kofi.osei@mail.com',   'Business', 'Nairobi', 1, 'active'),
(2, 1, 'Mary',  'Kamau', 'mother', '0723456789', 'mary.kamau@mail.com',  'Nurse',    'Nairobi', 1, 'active'),
(3, 1, 'Peter', 'Mutua', 'father', '0734567890', 'peter.mutua@mail.com', 'Engineer', 'Nairobi', 1, 'active');

INSERT INTO student_guardians (id, school_id, student_id, guardian_id, can_pickup, financial_responsibility)
VALUES
(1, 1, 1, 1, 1, 1),
(2, 1, 4, 1, 1, 1),
(3, 1, 2, 2, 1, 1),
(4, 1, 3, 3, 1, 1);

-- Portal Accounts 
INSERT INTO users (user_id, school_id, student_id, full_name, email, password_hash, role, status)
VALUES
(4,  1, 1, 'Mr. Kofi Osei (Parent)',    'adm-2020-001.parent@portal',  '$2b$10$placeholder_parent_hash',  'parent',  'active'),
(5,  1, 1, 'Amara Osei (Student)',      'adm-2020-001.student@portal', '$2b$10$placeholder_student_hash', 'student', 'active'),
(6,  1, 4, 'Mr. Kofi Osei (Parent)',    'adm-2022-004.parent@portal',  '$2b$10$placeholder_parent_hash',  'parent',  'active'),
(7,  1, 4, 'Kevin Osei (Student)',      'adm-2022-004.student@portal', '$2b$10$placeholder_student_hash', 'student', 'active'),
(8,  1, 2, 'Mrs. Mary Kamau (Parent)',  'adm-2019-002.parent@portal',  '$2b$10$placeholder_parent_hash',  'parent',  'active'),
(9,  1, 2, 'Brian Kamau (Student)',     'adm-2019-002.student@portal', '$2b$10$placeholder_student_hash', 'student', 'active'),
(10, 1, 3, 'Mr. Peter Mutua (Parent)', 'adm-2021-003.parent@portal',  '$2b$10$placeholder_parent_hash',  'parent',  'active'),
(11, 1, 3, 'Chloe Mutua (Student)',    'adm-2021-003.student@portal', '$2b$10$placeholder_student_hash', 'student', 'active');

-- Subjects 
INSERT INTO subjects (subject_id, school_id, subject_name, code, status)
VALUES
(1, 1, 'Mathematics', 'MAT', 'active'),
(2, 1, 'English',     'ENG', 'active'),
(3, 1, 'Biology',     'BIO', 'active'),
(4, 1, 'Physics',     'PHY', 'active');

INSERT INTO class_subjects (class_subject_id, school_id, class_id, subject_id, teacher_id)
VALUES
(1, 1, 3, 1, 1), (2, 1, 3, 2, 2),
(3, 1, 4, 1, 1), (4, 1, 4, 2, 2), (5, 1, 4, 3, 1), (6, 1, 4, 4, 1);

-- Timetable 
INSERT INTO timetable_entries (timetable_id, school_id, class_id, subject_name, teacher_id, day_of_week, start_time, end_time, room)
VALUES
(1, 1, 3, 'Mathematics', 1, 'Mon', '08:00', '09:00', 'Room 7A'),
(2, 1, 3, 'English',     2, 'Mon', '09:00', '10:00', 'Room 7A'),
(3, 1, 3, 'Physics',     1, 'Tue', '08:00', '09:00', 'Lab 1'),
(4, 1, 3, 'Mathematics', 1, 'Wed', '08:00', '09:00', 'Room 7A'),
(5, 1, 3, 'English',     2, 'Thu', '09:00', '10:00', 'Room 7A'),
(6, 1, 3, 'Biology',     1, 'Fri', '08:00', '09:00', 'Lab 2');

-- Exams 
INSERT INTO exams (exam_id, school_id, exam_name, term, academic_year, start_date, end_date, status)
VALUES (1, 1, 'Midterm', 'Term 2', 2026, '2026-06-10', '2026-06-14', 'published');

-- Results 
INSERT INTO results (result_id, school_id, student_id, subject, term, marks, total_marks, grade, class_id, teacher_id, teacher_comment)
VALUES
(1, 1, 1, 'Mathematics', 'Term 2', 87, 100, 'ME', 3, 1, 'Good work'),
(2, 1, 1, 'English',     'Term 2', 74, 100, 'ME', 3, 2, 'Keep improving'),
(3, 1, 2, 'Mathematics', 'Term 2', 92, 100, 'EE', 4, 1, 'Excellent'),
(4, 1, 4, 'Mathematics', 'Term 2', 78, 100, 'ME', 1, 1, 'Well done Kevin');

-- Attendance 
INSERT INTO attendance (attendance_id, school_id, student_id, class_id, attendance_date, status, marked_by_user_id)
VALUES
(1, 1, 1, 3, '2026-03-01', 'present', 2),
(2, 1, 2, 4, '2026-03-01', 'absent',  2),
(3, 1, 3, 2, '2026-03-01', 'late',    2),
(4, 1, 4, 1, '2026-03-01', 'present', 2);

-- Fee Structures 
INSERT INTO fee_structures (fee_structure_id, school_id, class_name, term, tuition, activity, misc)
VALUES
(1, 1, 'Grade 5', 'Term 2', 14000, 1500, 500),
(2, 1, 'Grade 6', 'Term 2', 15000, 2000, 500),
(3, 1, 'Grade 7', 'Term 2', 16000, 2000, 500),
(4, 1, 'Grade 8', 'Term 2', 17000, 2000, 500);

-- Payments 
INSERT INTO payments (payment_id, school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term, paid_by)
VALUES
(1, 1, 1, 15000, 'tuition',  'mpesa', 'QWE123XYZ', '2026-03-02', 'paid', 'Term 2', 'Mr. Kofi Osei'),
(2, 1, 2,  8000, 'tuition',  'bank',  'BNK778899', '2026-03-03', 'paid', 'Term 2', 'Mrs. Mary Kamau'),
(3, 1, 3,  2000, 'activity', 'cash',  'CASH-001',  '2026-03-04', 'paid', 'Term 2', 'Mr. Peter Mutua');

-- Transport 
INSERT INTO transport_routes (transport_id, school_id, route_name, driver_name, driver_phone, vehicle_number, fee, status)
VALUES (1, 1, 'Kilimani Route', 'Daniel Kariuki', '0744556677', 'KDA 123A', 3000, 'active');

INSERT INTO student_transport (id, school_id, student_id, transport_id, start_date, status)
VALUES (1, 1, 1, 1, '2026-01-10', 'active');

-- Library 
INSERT INTO books (book_id, school_id, title, author, category, isbn, quantity_total, quantity_available, status)
VALUES
(1, 1, 'Kenya Primary Maths 7', 'KICD',   'Mathematics', '9789966000001', 20, 18, 'active'),
(2, 1, 'Oxford English 7',      'Oxford', 'Languages',   '9780190000002', 15, 15, 'active');

INSERT INTO borrow_records (borrow_id, school_id, book_id, borrower_id, borrower_type, borrow_date, due_date, status)
VALUES (1, 1, 1, 1, 'student', '2026-03-01', '2026-03-15', 'borrowed');

-- Discipline 
INSERT INTO discipline_records (discipline_id, school_id, student_id, teacher_id, incident_type, incident_details, action_taken, incident_date, status)
VALUES (1, 1, 2, 2, 'Late coming', 'Student arrived 40 minutes late', 'Parent notified', '2026-03-01', 'closed');

-- SMS Logs 
INSERT INTO sms_logs (sms_id, school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
VALUES (1, 1, '+254712345678', 'Fee reminder: Kindly clear outstanding balance.', 'sms', 'sent', 3, '2026-03-05 10:15:00');

-- HR Staff (sample) 
INSERT INTO hr_staff (staff_id, school_id, full_name, email, phone, national_id, department, job_title, contract_type, start_date, salary, status)
VALUES
(1, 1, 'Mrs. Wanjiku',  'admin@greenfield.ac.ke',   '+254712345678', '11111111', 'Administration', 'School Principal',    'Permanent', '2020-01-01', 85000, 'active'),
(2, 1, 'Grace Akinyi',  'teacher@greenfield.ac.ke', '+254711222333', '22222222', 'Academic',       'Mathematics Teacher', 'Permanent', '2024-01-15', 55000, 'active'),
(3, 1, 'James Mwangi',  'j.mwangi@greenfield.ac.ke','+254722333444', '33333333', 'Academic',       'English Teacher',     'Permanent', '2023-09-01', 55000, 'active'),
(4, 1, 'Peter Maina',   'finance@greenfield.ac.ke', '+254733444555', '44444444', 'Finance',        'Finance Officer',     'Permanent', '2022-03-01', 60000, 'active'),
(5, 1, 'Jane Otieno',   'hr@greenfield.ac.ke',      '+254755666777', '55555555', 'Administration', 'HR Officer',          'Permanent', '2023-01-01', 58000, 'active'),
(6, 1, 'Daniel Kariuki','',                         '+254744556677', '66666666', 'Transport',      'Driver',              'Contract',  '2024-06-01', 30000, 'active');

-- Sanity checks 
SELECT COUNT(*) AS schools    FROM schools;
SELECT COUNT(*) AS users      FROM users;
SELECT COUNT(*) AS students   FROM students;
SELECT COUNT(*) AS teachers   FROM teachers;
SELECT COUNT(*) AS attendance FROM attendance;
SELECT COUNT(*) AS results    FROM results;
SELECT COUNT(*) AS payments   FROM payments;
SELECT COUNT(*) AS hr_staff   FROM hr_staff;