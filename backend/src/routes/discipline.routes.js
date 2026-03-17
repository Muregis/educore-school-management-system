import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role, studentId: tokenStudentId } = req.user;

    // Portal users can only see their own student's records
    const filterStudentId = ["parent","student"].includes(role) ? tokenStudentId : (req.query.studentId || null);

    let q = supabase
      .from('discipline_records')
      .select('discipline_id, student_id, incident_type, incident_details, action_taken, incident_date, status, students(first_name, last_name, admission_number)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    
    if (filterStudentId) {
      q = q.eq('student_id', filterStudentId);
    }
    
    const { data: rows, error } = await q.order('incident_date', { ascending: false });
    if (error) throw error;
    
    // Flatten joined data
    const result = (rows || []).map(r => ({
      ...r,
      first_name: r.students?.first_name,
      last_name: r.students?.last_name,
      admission_number: r.students?.admission_number,
      students: undefined
    }));
    
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, teacherId = null, incidentType, incidentDetails = null, actionTaken = null, incidentDate, status = "open" } = req.body;
    if (!studentId || !incidentType || !incidentDate)
      return res.status(400).json({ message: "studentId, incidentType, incidentDate are required" });

    const { data: inserted, error } = await supabase
      .from('discipline_records')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        teacher_id: teacherId,
        incident_type: incidentType,
        incident_details: incidentDetails,
        action_taken: actionTaken,
        incident_date: incidentDate,
        status
      })
      .select('discipline_id')
      .single();
    if (error) throw error;
    res.status(201).json({ disciplineId: inserted.discipline_id });
  } catch (err) { next(err); }
});

router.put("/:id", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, actionTaken } = req.body;
    // OLD: const [result] = await pool.query(`UPDATE discipline_records SET status=?, action_taken=?, updated_at=CURRENT_TIMESTAMP WHERE discipline_id=? AND school_id=? AND is_deleted=0`, [status, actionTaken || null, req.params.id, schoolId]);
    const { data: updated, error } = await supabase
      .from('discipline_records')
      .update({ status, action_taken: actionTaken || null, updated_at: new Date().toISOString() })
      .eq('discipline_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('discipline_id')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Record not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

export default router;
