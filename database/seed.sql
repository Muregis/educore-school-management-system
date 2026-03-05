USE educore_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE sms_logs;
TRUNCATE TABLE borrow_records;
TRUNCATE TABLE books;
TRUNCATE TABLE student_transport;
TRUNCATE TABLE transport_routes;
TRUNCATE TABLE payments;
TRUNCATE TABLE fee_structure_items;
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
TRUNCATE TABLE schools;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO schools (school_id, name, code, email, phone, address, county, subscription_status, subscription_start, subscription_end)
VALUES
(1, 'Greenfield Academy', 'GFA-001', 'admin@greenfield.ac.ke', '+254712345678', '123 Ngong Road, Nairobi', 'Nairobi', 'active', '2026-01-01', '2026-12-31');

-- demo passwords in plain comment:
-- admin@greenfield.ac.ke / admin123
-- teacher@greenfield.ac.ke / teacher123
-- finance@greenfield.ac.ke / finance123
INSERT INTO users (user_id, school_id, full_name, email, phone, password_hash, role, status)
VALUES
(1, 1, 'Mrs. Wanjiku', 'admin@greenfield.ac.ke', '+254712345678', '$2b$10$placeholder_admin_hash', 'admin', 'active'),
(2, 1, 'Grace Akinyi', 'teacher@greenfield.ac.ke', '+254711222333', '$2b$10$placeholder_teacher_hash', 'teacher', 'active'),
(3, 1, 'Peter Maina', 'finance@greenfield.ac.ke', '+254733444555', '$2b$10$placeholder_finance_hash', 'finance', 'active');

INSERT INTO teachers (teacher_id, school_id, user_id, staff_number, national_id, first_name, last_name, email, phone, hire_date, department, qualification, status)
VALUES
(1, 1, 2, 'T-0001', '12345678', 'Grace', 'Akinyi', 'teacher@greenfield.ac.ke', '+254711222333', '2024-01-15', 'Sciences', 'B.Ed Mathematics', 'active'),
(2, 1, NULL, 'T-0002', '23456789', 'James', 'Mwangi', 'j.mwangi@greenfield.ac.ke', '+254722333444', '2023-09-01', 'Languages', 'BA Education', 'active');

INSERT INTO classes (class_id, school_id, class_name, section, class_teacher_id, academic_year, status)
VALUES
(1, 1, 'Grade 7', 'A', 1, 2026, 'active'),
(2, 1, 'Grade 8', 'A', 2, 2026, 'active');

INSERT INTO students (student_id, school_id, class_id, admission_number, first_name, last_name, gender, date_of_birth, phone, admission_date, status)
VALUES
(1, 1, 1, 'ADM-2020-001', 'Amara', 'Osei', 'female', '2012-03-14', '0712345678', '2020-01-10', 'active'),
(2, 1, 2, 'ADM-2019-002', 'Brian', 'Kamau', 'male', '2011-07-22', '0723456789', '2019-01-15', 'active'),
(3, 1, 1, 'ADM-2021-003', 'Chloe', 'Mutua', 'female', '2013-01-05', '0734567890', '2021-01-12', 'active');

INSERT INTO guardians (guardian_id, school_id, first_name, last_name, relationship_type, phone, email, occupation, address, is_primary, status)
VALUES
(1, 1, 'Kofi', 'Osei', 'father', '0712345678', 'kofi.osei@mail.com', 'Business', 'Nairobi', 1, 'active'),
(2, 1, 'Mary', 'Kamau', 'mother', '0723456789', 'mary.kamau@mail.com', 'Nurse', 'Nairobi', 1, 'active'),
(3, 1, 'Peter', 'Mutua', 'father', '0734567890', 'peter.mutua@mail.com', 'Engineer', 'Nairobi', 1, 'active');

INSERT INTO student_guardians (id, school_id, student_id, guardian_id, can_pickup, financial_responsibility)
VALUES
(1, 1, 1, 1, 1, 1),
(2, 1, 2, 2, 1, 1),
(3, 1, 3, 3, 1, 1);

INSERT INTO subjects (subject_id, school_id, subject_name, code, status)
VALUES
(1, 1, 'Mathematics', 'MAT', 'active'),
(2, 1, 'English', 'ENG', 'active'),
(3, 1, 'Biology', 'BIO', 'active'),
(4, 1, 'Physics', 'PHY', 'active');

INSERT INTO class_subjects (class_subject_id, school_id, class_id, subject_id, teacher_id)
VALUES
(1, 1, 1, 1, 1),
(2, 1, 1, 2, 2),
(3, 1, 2, 1, 1),
(4, 1, 2, 2, 2),
(5, 1, 2, 3, 1),
(6, 1, 2, 4, 1);

INSERT INTO exams (exam_id, school_id, exam_name, term, academic_year, start_date, end_date, status)
VALUES
(1, 1, 'Midterm', 'Term 2', 2026, '2026-06-10', '2026-06-14', 'published');

INSERT INTO results (result_id, school_id, student_id, subject_id, exam_id, class_id, teacher_id, marks_obtained, total_marks, grade, teacher_comment)
VALUES
(1, 1, 1, 1, 1, 1, 1, 87, 100, 'ME', 'Good work'),
(2, 1, 1, 2, 1, 1, 2, 74, 100, 'ME', 'Keep improving'),
(3, 1, 2, 1, 1, 2, 1, 92, 100, 'EE', 'Excellent');

INSERT INTO attendance (attendance_id, school_id, student_id, class_id, attendance_date, status, marked_by_user_id)
VALUES
(1, 1, 1, 1, '2026-03-01', 'present', 2),
(2, 1, 2, 2, '2026-03-01', 'absent', 2),
(3, 1, 3, 1, '2026-03-01', 'late', 2);

INSERT INTO fee_structures (fee_structure_id, school_id, class_id, term, academic_year, is_active)
VALUES
(1, 1, 1, 'Term 2', 2026, 1),
(2, 1, 2, 'Term 2', 2026, 1);

INSERT INTO fee_structure_items (fee_item_id, school_id, fee_structure_id, fee_type, amount, description)
VALUES
(1, 1, 1, 'tuition', 15000, 'Term tuition'),
(2, 1, 1, 'activity', 2000, 'Clubs and sports'),
(3, 1, 1, 'misc', 500, 'General misc'),
(4, 1, 2, 'tuition', 17000, 'Term tuition'),
(5, 1, 2, 'activity', 2000, 'Clubs and sports'),
(6, 1, 2, 'misc', 500, 'General misc');

INSERT INTO payments (payment_id, school_id, student_id, fee_structure_id, amount, fee_type, payment_method, reference_number, payment_date, status, received_by_user_id)
VALUES
(1, 1, 1, 1, 15000, 'tuition', 'mpesa', 'QWE123XYZ', '2026-03-02', 'paid', 3),
(2, 1, 2, 2, 8000, 'tuition', 'bank', 'BNK778899', '2026-03-03', 'paid', 3),
(3, 1, 3, 1, 2000, 'activity', 'cash', 'CASH-001', '2026-03-04', 'paid', 3);

INSERT INTO transport_routes (transport_id, school_id, route_name, driver_name, vehicle_number, fee, status)
VALUES
(1, 1, 'Kilimani Route', 'Daniel Kariuki', 'KDA 123A', 3000, 'active');

INSERT INTO student_transport (id, school_id, student_id, transport_id, start_date, status)
VALUES
(1, 1, 1, 1, '2026-01-10', 'active');

INSERT INTO books (book_id, school_id, title, author, category, isbn, quantity_total, quantity_available, status)
VALUES
(1, 1, 'Kenya Primary Maths 7', 'KICD', 'Mathematics', '9789966000001', 20, 18, 'active'),
(2, 1, 'Oxford English 7', 'Oxford', 'Languages', '9780190000002', 15, 15, 'active');

INSERT INTO borrow_records (borrow_id, school_id, book_id, student_id, borrow_date, due_date, status)
VALUES
(1, 1, 1, 1, '2026-03-01', '2026-03-15', 'borrowed');

INSERT INTO discipline_records (discipline_id, school_id, student_id, teacher_id, incident_type, incident_details, action_taken, incident_date, status)
VALUES
(1, 1, 2, 2, 'Late coming', 'Student arrived 40 minutes late', 'Parent notified', '2026-03-01', 'closed');

INSERT INTO sms_logs (sms_id, school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
VALUES
(1, 1, '+254712345678', 'Fee reminder: Kindly clear outstanding balance.', 'sms', 'sent', 3, '2026-03-05 10:15:00');

-- quick sanity checks
SELECT COUNT(*) AS schools FROM schools;
SELECT COUNT(*) AS users FROM users;
SELECT COUNT(*) AS students FROM students;
SELECT COUNT(*) AS teachers FROM teachers;
SELECT COUNT(*) AS attendance_records FROM attendance;
SELECT COUNT(*) AS result_records FROM results;
SELECT COUNT(*) AS payments FROM payments;
