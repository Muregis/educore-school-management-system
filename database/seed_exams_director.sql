-- EduCore Postgres/Supabase seed
-- Sample announcements for director role testing
-- Run this after creating the director user (user_id should be updated accordingly)

-- First, ensure we have a director user (update user_id if needed)
-- This assumes a director user exists with user_id = 100, school_id = 1
-- Adjust the user_id to match your actual director user

INSERT INTO public.announcements
  (announcement_id, school_id, title, message, type, status, priority, target_audience, pinned, author_user_id, publish_date, expiry_date, is_deleted, created_at, updated_at)
VALUES
  (1, 1, 'Welcome to Term 2 2026', 'We are excited to welcome all students and staff back for Term 2 2026. Classes begin on Monday, May 3rd. Please ensure all students report to school on time with complete uniforms and learning materials.', 'general', 'published', 'high', 'all', true, 100, '2026-05-01 08:00:00+00', '2026-05-31 23:59:59+00', false, NOW(), NOW()),
  
  (2, 1, 'Parent-Teacher Meeting', 'All parents are invited to attend the Parent-Teacher Meeting scheduled for Friday, May 21st at 2:00 PM in the school hall. We will discuss student progress and upcoming school activities.', 'event', 'published', 'normal', 'all', false, 100, '2026-05-10 09:00:00+00', '2026-05-20 23:59:59+00', false, NOW(), NOW()),
  
  (3, 1, 'Mid-Term Examination Schedule', 'Mid-term examinations will commence on June 10th and conclude on June 14th. Students are advised to prepare adequately. The examination timetable has been posted on the notice board.', 'academic', 'published', 'high', 'all', true, 100, '2026-05-15 10:00:00+00', '2026-06-15 23:59:59+00', false, NOW(), NOW()),
  
  (4, 1, 'School Holiday Notice', 'The school will be closed for the mid-term break from June 15th to June 20th. Classes resume on June 21st. Parents are requested to ensure students return on time.', 'general', 'published', 'normal', 'all', false, 100, '2026-05-20 11:00:00+00', '2026-06-20 23:59:59+00', false, NOW(), NOW()),
  
  (5, 1, 'Sports Day Preparation', 'Our annual sports day will be held on July 5th. All students are required to participate. House captains should start preparing their teams. Practice sessions will be held every afternoon from 3:00 PM.', 'event', 'published', 'normal', 'all', false, 100, '2026-05-25 12:00:00+00', '2026-07-05 23:59:59+00', false, NOW(), NOW()),
  
  (6, 1, 'Staff Meeting - Curriculum Review', 'All teaching staff are required to attend a curriculum review meeting on Wednesday, May 26th at 3:30 PM in the staff room. Please bring your subject files and assessment records.', 'academic', 'published', 'normal', 'teachers', false, 100, '2026-05-18 14:00:00+00', '2026-05-26 23:59:59+00', false, NOW(), NOW()),
  
  (7, 1, 'Fee Payment Reminder', 'This is a reminder to all parents that Term 2 fees are due by May 30th. Late payments will attract a penalty. Please contact the finance office for any payment arrangements.', 'general', 'published', 'high', 'parents', true, 100, '2026-05-12 08:00:00+00', '2026-05-30 23:59:59+00', false, NOW(), NOW()),
  
  (8, 1, 'Library Books Return', 'All students must return library books borrowed during Term 1 by May 15th. Failure to return books will result in a fine and restriction of borrowing privileges.', 'academic', 'published', 'normal', 'students', false, 100, '2026-05-05 09:00:00+00', '2026-05-15 23:59:59+00', false, NOW(), NOW())
ON CONFLICT (announcement_id) DO NOTHING;

-- Keep identity sequence in sync
SELECT setval(
  pg_get_serial_sequence('public.announcements', 'announcement_id'),
  COALESCE((SELECT MAX(announcement_id) FROM public.announcements), 1)
);

-- Note: Update author_user_id (currently set to 100) to match your actual director user_id
-- You can find the director user_id by running: SELECT user_id, full_name, role FROM users WHERE role = 'director';
