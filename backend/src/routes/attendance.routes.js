import express from 'express';
import { supabase } from '../config/supabase.js'; // Adjust path as needed

const router = express.Router();

// GET /attendance - Fetch all attendance records with student details
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role, user_id } = req.user;
    const { classId, date, from, to, studentId } = req.query;

    let query = supabase
      .from('attendance')
      .select(`
        attendance_id,
        student_id,
        attendance_date,
        status,
        class_id,
        students!inner(
          student_id,
          first_name,
          last_name,
          admission_number,
          class_name
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    // RESTRICTION: If user is a teacher, only show their assigned classes
    if (role === 'teacher') {
      const { data: teacherClasses } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('teacher_id', user_id)
        .eq('is_deleted', false);
      
      const allowedClassIds = teacherClasses?.map(tc => tc.class_id) || [];
      if (allowedClassIds.length > 0) {
        query = query.in('class_id', allowedClassIds);
      }
    }

    if (classId)   { query = query.eq('class_id', classId); }
    if (studentId) { query = query.eq('student_id', studentId); }
    if (date)      { query = query.eq('attendance_date', date); }
    if (from)      { query = query.gte('attendance_date', from); }
    if (to)        { query = query.lte('attendance_date', to); }

    query = query
      .order('attendance_date', { ascending: false })
      .order('attendance_id',   { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // FIX: Properly flatten student data to match frontend expectations
    const transformedData = data?.map(item => {
      const student = item.students || {};
      return {
        attendance_id:   item.attendance_id,
        student_id:      item.student_id,
        first_name:      student.first_name || '',
        last_name:       student.last_name || '',
        admission_number: student.admission_number || null,
        class_name:      student.class_name || null,
        attendance_date: item.attendance_date,
        status:          item.status,
        class_id:        item.class_id,
      };
    }) || [];

    res.json(transformedData);
  } catch (err) { 
    next(err); 
  }
});

// POST /attendance/bulk - Bulk create attendance records for a class
router.post("/bulk", async (req, res, next) => {
  try {
    const { schoolId, role, user_id } = req.user;
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: classId, date, records' });
    }

    // RESTRICTION: If user is a teacher, verify they can access this class
    if (role === 'teacher') {
      const { data: teacherClasses } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('teacher_id', user_id)
        .eq('is_deleted', false);
      
      const allowedClassIds = teacherClasses?.map(tc => tc.class_id) || [];
      if (!allowedClassIds.includes(Number(classId))) {
        return res.status(403).json({ error: 'Access denied: You can only manage attendance for your assigned classes' });
      }
    }

    // Prepare bulk insert data
    const attendanceRecords = records.map(r => ({
      school_id: schoolId,
      student_id: r.studentId,
      class_id: classId,
      attendance_date: date,
      status: r.status || 'present',
      is_deleted: false,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('attendance')
      .insert(attendanceRecords)
      .select();

    if (error) throw error;

    res.status(201).json({ 
      message: 'Bulk attendance saved successfully',
      count: data.length 
    });
  } catch (err) { 
    next(err); 
  }
});

// PUT /attendance/:id - Update single attendance record
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { status, date } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (date) updateData.attendance_date = date;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('attendance')
      .update(updateData)
      .eq('attendance_id', id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Attendance record not found' });

    res.json({ 
      message: 'Attendance updated successfully',
      data 
    });
  } catch (err) { 
    next(err); 
  }
});

// DELETE /attendance/:id - Soft delete attendance record
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('attendance')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString() 
      })
      .eq('attendance_id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Attendance record not found' });

    res.json({ message: 'Attendance deleted successfully' });
  } catch (err) { 
    next(err); 
  }
});

export default router;