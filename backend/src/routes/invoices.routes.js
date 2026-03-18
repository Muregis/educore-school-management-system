import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { supabase } from "../config/supabaseClient.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// GET invoices
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*, students(first_name, last_name, class_name, admission_number)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Flatten joined data
    const rows = (invoices || []).map(i => ({
      ...i,
      student_name: i.students ? `${i.students.first_name} ${i.students.last_name}` : null,
      class_name: i.students?.class_name,
      admission_number: i.students?.admission_number,
      students: undefined
    }));
    res.json(rows);
  } catch (err) { next(err); }
});

// POST generate invoice for student
router.post("/", requireRoles("admin","finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term = "Term 2", academicYear = "2026", tuition = 0, activity = 0, misc = 0, transport = 0, dueDate } = req.body;
    if (!studentId) return res.status(400).json({ message: "studentId is required" });

    const invoiceNumber = `INV-${schoolId}-${studentId}-${Date.now()}`;
    const { data: inserted, error: insertError } = await supabase
      .from('invoices')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        invoice_number: invoiceNumber,
        term,
        academic_year: academicYear,
        tuition,
        activity,
        misc,
        transport,
        due_date: dueDate || null
      })
      .select('invoice_id')
      .single();
    if (insertError) throw insertError;
    res.status(201).json({ invoiceId: inserted.invoice_id, invoiceNumber });
  } catch (err) { next(err); }
});

// POST bulk generate invoices for entire class
router.post("/bulk", requireRoles("admin","finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, term = "Term 2", academicYear = "2026", dueDate } = req.body;
    if (!className) return res.status(400).json({ message: "className is required" });

    // Get fee structure for class
    const { data: feeStructure, error: feeError } = await supabase
      .from('fee_structures')
      .select('tuition, activity, misc')
      .eq('school_id', schoolId)
      .eq('class_name', className)
      .eq('is_deleted', false)
      .single();
    if (feeError || !feeStructure) return res.status(404).json({ message: "No fee structure found for this class" });
    const { tuition, activity, misc } = feeStructure;

    // Get all students in class
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('class_name', className)
      .eq('is_deleted', false);
    if (studentError) throw studentError;
    if (!students?.length) return res.status(404).json({ message: "No students found in this class" });

    let created = 0;
    for (const s of students) {
      const invoiceNumber = `INV-${schoolId}-${s.student_id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      try {
        await supabase.from('invoices').insert({
          school_id: schoolId,
          student_id: s.student_id,
          invoice_number: invoiceNumber,
          term,
          academic_year: academicYear,
          tuition,
          activity,
          misc,
          due_date: dueDate || null
        });
        created++;
      } catch { /* skip duplicates */ }
    }
    res.json({ created, total: students.length });
  } catch (err) { next(err); }
});

// PATCH update invoice status
router.patch("/:id", requireRoles("admin","finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.body;
    const { error } = await supabase
      .from('invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('invoice_id', req.params.id)
      .eq('school_id', schoolId);
    if (error) throw error;
    res.json({ updated: true });
  } catch (err) { next(err); }
});

export default router;
