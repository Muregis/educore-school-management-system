-- EduCore Postgres/Supabase seed (analysis_seed.sql port)
-- Adds extra streams (classes B/C) and extra students.
-- Run AFTER you have created and seeded: schools, users, teachers, classes, students.

INSERT INTO public.classes
  (class_id, school_id, class_name, section, class_teacher_id, academic_year, status)
VALUES
  (5,  1, 'Grade 5', 'B', 2, 2026, 'active'),
  (6,  1, 'Grade 5', 'C', 1, 2026, 'active'),
  (7,  1, 'Grade 6', 'B', 2, 2026, 'active'),
  (8,  1, 'Grade 6', 'C', 1, 2026, 'active'),
  (9,  1, 'Grade 7', 'B', 2, 2026, 'active'),
  (10, 1, 'Grade 7', 'C', 1, 2026, 'active'),
  (11, 1, 'Grade 8', 'B', 2, 2026, 'active'),
  (12, 1, 'Grade 8', 'C', 1, 2026, 'active')
ON CONFLICT (class_id) DO NOTHING;

INSERT INTO public.students
  (student_id, school_id, class_id, class_name, admission_number, first_name, last_name, gender, date_of_birth, parent_name, parent_phone, admission_date, status)
VALUES
  (10,1,9,'Grade 7','ADM-2020-010','Liam','Waweru','male','2012-05-10','Mr. James Waweru','0711000001','2020-01-10','active'),
  (11,1,9,'Grade 7','ADM-2020-011','Nadia','Gitau','female','2012-08-22','Mrs. Anne Gitau','0711000002','2020-01-10','active'),
  (12,1,9,'Grade 7','ADM-2020-012','Tom','Otieno','male','2012-01-15','Mr. Dan Otieno','0711000003','2020-01-10','active'),
  (13,1,10,'Grade 7','ADM-2020-013','Sara','Kimani','female','2012-04-20','Mrs. Ruth Kimani','0711000004','2020-01-10','active'),
  (14,1,10,'Grade 7','ADM-2020-014','Alex','Maina','male','2012-11-30','Mr. Paul Maina','0711000005','2020-01-10','active'),
  (15,1,10,'Grade 7','ADM-2020-015','Grace','Njoroge','female','2012-07-07','Mrs. Lucy Njoroge','0711000006','2020-01-10','active'),
  (16,1,11,'Grade 8','ADM-2019-016','David','Kariuki','male','2011-03-14','Mr. Ben Kariuki','0711000007','2019-01-10','active'),
  (17,1,11,'Grade 8','ADM-2019-017','Faith','Odhiambo','female','2011-09-18','Mrs. Jane Odhiambo','0711000008','2019-01-10','active'),
  (18,1,11,'Grade 8','ADM-2019-018','Mike','Njeru','male','2011-12-01','Mr. Sam Njeru','0711000009','2019-01-10','active'),
  (19,1,12,'Grade 8','ADM-2019-019','Purity','Wanjiku','female','2011-06-25','Mrs. Wanjiku Sr','0711000010','2019-01-10','active'),
  (20,1,12,'Grade 8','ADM-2019-020','Kevin','Mwenda','male','2011-02-14','Mr. Tony Mwenda','0711000011','2019-01-10','active'),
  (21,1,12,'Grade 8','ADM-2019-021','Sharon','Auma','female','2011-10-10','Mrs. Rose Auma','0711000012','2019-01-10','active'),
  (22,1,7,'Grade 6','ADM-2021-022','Irene','Mwangi','female','2013-03-10','Mr. John Mwangi','0711000013','2021-01-10','active'),
  (23,1,7,'Grade 6','ADM-2021-023','Felix','Kamau','male','2013-07-15','Mrs. Eva Kamau','0711000014','2021-01-10','active'),
  (24,1,7,'Grade 6','ADM-2021-024','Joy','Otieno','female','2013-11-20','Mr. Ken Otieno','0711000015','2021-01-10','active'),
  (25,1,8,'Grade 6','ADM-2021-025','Moses','Githinji','male','2013-05-05','Mr. Chris Githinji','0711000016','2021-01-10','active'),
  (26,1,8,'Grade 6','ADM-2021-026','Esther','Karanja','female','2013-09-09','Mrs. Hellen Karanja','0711000017','2021-01-10','active'),
  (27,1,8,'Grade 6','ADM-2021-027','Philip','Omondi','male','2013-01-25','Mr. George Omondi','0711000018','2021-01-10','active'),
  (28,1,5,'Grade 5','ADM-2022-028','Ann','Wambua','female','2014-04-12','Mrs. Jane Wambua','0711000019','2022-01-10','active'),
  (29,1,5,'Grade 5','ADM-2022-029','Eric','Mugo','male','2014-08-30','Mr. Peter Mugo','0711000020','2022-01-10','active'),
  (30,1,5,'Grade 5','ADM-2022-030','Lynn','Achieng','female','2014-12-15','Mrs. Achieng Sr','0711000021','2022-01-10','active'),
  (31,1,6,'Grade 5','ADM-2022-031','Dennis','Nzomo','male','2014-02-20','Mr. Victor Nzomo','0711000022','2022-01-10','active'),
  (32,1,6,'Grade 5','ADM-2022-032','Vivian','Mutuku','female','2014-06-06','Mrs. Lucy Mutuku','0711000023','2022-01-10','active'),
  (33,1,6,'Grade 5','ADM-2022-033','Henry','Koech','male','2014-10-10','Mr. Robert Koech','0711000024','2022-01-10','active')
ON CONFLICT DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.classes', 'class_id'),
  COALESCE((SELECT MAX(class_id) FROM public.classes), 1)
);

SELECT setval(
  pg_get_serial_sequence('public.students', 'student_id'),
  COALESCE((SELECT MAX(student_id) FROM public.students), 1)
);

