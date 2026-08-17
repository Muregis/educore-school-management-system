-- EduCore Attendance Offline POC - Seed Data
-- Database: educore_attendance_poc

-- School
INSERT INTO schools (school_id, name, code, email, phone, address, county, country) VALUES
(1, 'EduCore POC School', 'POC001', 'poc@educore.test', '+254 700 000000', '123 POC Street, Nairobi', 'Nairobi', 'Kenya')
ON CONFLICT (school_id) DO NOTHING;

-- Users
INSERT INTO users (user_id, school_id, full_name, email, password_hash, role, status) VALUES
(1, 1, 'Admin User', 'admin@educore.test', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active'),
(2, 1, 'Teacher Alice', 'alice@educore.test', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher', 'active'),
(3, 1, 'Teacher Bob', 'bob@educore.test', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher', 'active')
ON CONFLICT (user_id) DO NOTHING;

-- Classes
INSERT INTO classes (class_id, school_id, class_name, section, academic_year, status) VALUES
(1, 1, 'Form 1A', 'A', 2026, 'active'),
(2, 1, 'Form 1B', 'B', 2026, 'active')
ON CONFLICT (class_id) DO NOTHING;

-- Teachers
INSERT INTO teachers (teacher_id, school_id, user_id, staff_number, first_name, last_name, email, status) VALUES
(1, 1, 2, 'T001', 'Alice', 'Wanjiku', 'alice@educore.test', 'active'),
(2, 1, 3, 'T002', 'Bob', 'Kipchoge', 'bob@educore.test', 'active')
ON CONFLICT (teacher_id) DO NOTHING;

-- Students (10 per class)
INSERT INTO students (student_id, school_id, class_id, class_name, admission_number, first_name, last_name, gender, parent_name, parent_phone, status) VALUES
(1, 1, 1, 'Form 1A', 'ADM001', 'John', 'Doe', 'male', 'Jane Doe', '0712345678', 'active'),
(2, 1, 1, 'Form 1A', 'ADM002', 'Jane', 'Smith', 'female', 'John Smith', '0723456789', 'active'),
(3, 1, 1, 'Form 1A', 'ADM003', 'Mike', 'Johnson', 'male', 'Mary Johnson', '0734567890', 'active'),
(4, 1, 1, 'Form 1A', 'ADM004', 'Sarah', 'Williams', 'female', 'Peter Williams', '0745678901', 'active'),
(5, 1, 1, 'Form 1A', 'ADM005', 'David', 'Brown', 'male', 'Lisa Brown', '0756789012', 'active'),
(6, 1, 1, 'Form 1A', 'ADM006', 'Emily', 'Davis', 'female', 'Tom Davis', '0767890123', 'active'),
(7, 1, 1, 'Form 1A', 'ADM007', 'Chris', 'Miller', 'male', 'Anna Miller', '0778901234', 'active'),
(8, 1, 1, 'Form 1A', 'ADM008', 'Lisa', 'Wilson', 'female', 'James Wilson', '0789012345', 'active'),
(9, 1, 1, 'Form 1A', 'ADM009', 'Tom', 'Moore', 'male', 'Patricia Moore', '0790123456', 'active'),
(10, 1, 1, 'Form 1A', 'ADM010', 'Anna', 'Taylor', 'female', 'Robert Taylor', '0701234567', 'active'),
(11, 1, 2, 'Form 1B', 'ADM011', 'James', 'Anderson', 'male', 'Jennifer Anderson', '0711111111', 'active'),
(12, 1, 2, 'Form 1B', 'ADM012', 'Patricia', 'Thomas', 'female', 'Michael Thomas', '0722222222', 'active'),
(13, 1, 2, 'Form 1B', 'ADM013', 'Robert', 'Jackson', 'male', 'Linda Jackson', '0733333333', 'active'),
(14, 1, 2, 'Form 1B', 'ADM014', 'Jennifer', 'White', 'female', 'William White', '0744444444', 'active'),
(15, 1, 2, 'Form 1B', 'ADM015', 'Michael', 'Harris', 'male', 'Elizabeth Harris', '0755555555', 'active'),
(16, 1, 2, 'Form 1B', 'ADM016', 'Linda', 'Clark', 'female', 'David Clark', '0766666666', 'active'),
(17, 1, 2, 'Form 1B', 'ADM017', 'William', 'Lewis', 'male', 'Susan Lewis', '0777777777', 'active'),
(18, 1, 2, 'Form 1B', 'ADM018', 'Elizabeth', 'Robinson', 'female', 'Joseph Robinson', '0788888888', 'active'),
(19, 1, 2, 'Form 1B', 'ADM019', 'David', 'Walker', 'male', 'Margaret Walker', '0799999999', 'active'),
(20, 1, 2, 'Form 1B', 'ADM020', 'Susan', 'Hall', 'female', 'Charles Hall', '0700000000', 'active')
ON CONFLICT (student_id) DO NOTHING;

-- Teacher Class Assignments
INSERT INTO teacher_class_assignments (school_id, teacher_id, class_id, class_name, is_class_teacher, academic_year, term, is_active) VALUES
(1, 2, 1, 'Form 1A', true, 2026, 'Term 2', true),
(1, 3, 2, 'Form 1B', true, 2026, 'Term 2', true)
ON CONFLICT DO NOTHING;

-- Sample Attendance for today
INSERT INTO attendance (school_id, student_id, class_id, attendance_date, status, marked_by_user_id) VALUES
(1, 1, 1, CURRENT_DATE, 'present', 2),
(1, 2, 1, CURRENT_DATE, 'present', 2),
(1, 3, 1, CURRENT_DATE, 'absent', 2),
(1, 4, 1, CURRENT_DATE, 'late', 2),
(1, 5, 1, CURRENT_DATE, 'present', 2),
(1, 6, 1, CURRENT_DATE, 'present', 2),
(1, 7, 1, CURRENT_DATE, 'present', 2),
(1, 8, 1, CURRENT_DATE, 'absent', 2),
(1, 9, 1, CURRENT_DATE, 'present', 2),
(1, 10, 1, CURRENT_DATE, 'late', 2),
(1, 11, 2, CURRENT_DATE, 'present', 3),
(1, 12, 2, CURRENT_DATE, 'present', 3),
(1, 13, 2, CURRENT_DATE, 'absent', 3),
(1, 14, 2, CURRENT_DATE, 'present', 3),
(1, 15, 2, CURRENT_DATE, 'present', 3),
(1, 16, 2, CURRENT_DATE, 'late', 3),
(1, 17, 2, CURRENT_DATE, 'present', 3),
(1, 18, 2, CURRENT_DATE, 'present', 3),
(1, 19, 2, CURRENT_DATE, 'absent', 3),
(1, 20, 2, CURRENT_DATE, 'present', 3)
ON CONFLICT (school_id, student_id, attendance_date) DO NOTHING;

-- Reset sequences
SELECT setval(pg_get_serial_sequence('schools', 'school_id'), COALESCE((SELECT MAX(school_id) FROM schools), 1));
SELECT setval(pg_get_serial_sequence('users', 'user_id'), COALESCE((SELECT MAX(user_id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('classes', 'class_id'), COALESCE((SELECT MAX(class_id) FROM classes), 1));
SELECT setval(pg_get_serial_sequence('students', 'student_id'), COALESCE((SELECT MAX(student_id) FROM students), 1));
SELECT setval(pg_get_serial_sequence('teachers', 'teacher_id'), COALESCE((SELECT MAX(teacher_id) FROM teachers), 1));
SELECT setval(pg_get_serial_sequence('teacher_class_assignments', 'assignment_id'), COALESCE((SELECT MAX(assignment_id) FROM teacher_class_assignments), 1));
SELECT setval(pg_get_serial_sequence('attendance', 'attendance_id'), COALESCE((SELECT MAX(attendance_id) FROM attendance), 1));
