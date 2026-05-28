import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = Router();
router.use(authRequired);

// GET all assignments — admin sees all, teacher sees own
router.get('/', async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;
    let query = supabase
      .from('teacher_class_assignments')
      .select(`
        assignment_id, class_name, class_id,
        subject_name, is_class_teacher,
        academic_year, term, is_active,
        teacher:users(user_id, full_name, email)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true);

    if (role === 'teacher') query = query.eq('teacher_id', userId);
    const { data, error } = await query.order('class_name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

// GET classes assigned to logged in teacher
router.get('/my-classes', async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;

    if (['admin','director','superadmin','finance','hr'].includes(role)) {
      const { data } = await supabase
        .from('classes')
        .select('class_id, class_name')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .order('class_name');
      return res.json(data || []);
    }

    const { data, error } = await supabase
      .from('teacher_class_assignments')
      .select('class_id, class_name, subject_name, is_class_teacher')
      .eq('school_id', schoolId)
      .eq('teacher_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    const seen = new Set();
    const classes = (data || []).filter(c => {
      if (seen.has(c.class_name)) return false;
      seen.add(c.class_name);
      return true;
    });
    res.json(classes);
  } catch (err) { next(err); }
});

// POST assign teacher to class
router.post('/', requireRoles('admin','director','superadmin'),
  async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { teacherId, className, classId, subjectName,
            subjectId, isClassTeacher, academicYear, term } = req.body;

    if (!teacherId || !className) {
      return res.status(400).json({
        message: 'teacherId and className are required'
      });
    }

    const { data: existing } = await supabase
      .from('teacher_class_assignments')
      .select('assignment_id')
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId)
      .eq('class_name', className)
      .eq('subject_name', subjectName || '')
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        message: 'Teacher already assigned to this class and subject'
      });
    }

    const { data, error } = await supabase
      .from('teacher_class_assignments')
      .insert({
        school_id: schoolId,
        teacher_id: teacherId,
        class_id: classId || null,
        class_name: className,
        subject_id: subjectId || null,
        subject_name: subjectName || null,
        is_class_teacher: isClassTeacher || false,
        academic_year: academicYear || new Date().getFullYear().toString(),
        term: term || null,
        assigned_by: userId,
        is_active: true
      })
      .select('assignment_id')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, assignmentId: data.assignment_id });
  } catch (err) { next(err); }
});

// DELETE remove assignment
router.delete('/:id', requireRoles('admin','director','superadmin'),
  async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await supabase
      .from('teacher_class_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('assignment_id', req.params.id)
      .eq('school_id', schoolId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;