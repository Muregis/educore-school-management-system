import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { sendEmail, isEmailConfigured, templates } from "../services/email.service.js";
import { logActivity } from "../helpers/activity.logger.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";

const router = Router();
router.use(authRequired);

// ─── GET all payments (with student name) ────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: rows, error } = await supabase
      .from('payments')
      .select(`
        payment_id, student_id, amount, fee_type, payment_method,
        reference_number, payment_date, status, paid_by, term,
        students!left(
          first_name,
          last_name,
          class_name
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('payment_date', { ascending: false })
      .order('payment_id', { ascending: false });

    if (error) throw error;

    // Flatten the joined student fields to match original shape
    const result = (rows || []).map(p => ({
      ...p,
      first_name: p.students?.first_name ?? null,
      last_name:  p.students?.last_name  ?? null,
      class_name: p.students?.class_name ?? null,
      students: undefined,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// ─── GET fee structures ───────────────────────────────────────────────────────
router.get("/fee-structures", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: rows, error } = await supabase
      .from('fee_structures')
      .select('fee_structure_id, class_name, term, tuition, activity, misc')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('class_name');

    if (error) throw error;
    res.json(rows || []);
  } catch (err) { next(err); }
});

// ─── POST fee structure ───────────────────────────────────────────────────────
router.post("/fee-structures", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, term = "Term 2", tuition = 0, activity = 0, misc = 0 } = req.body;
    if (!className) return res.status(400).json({ message: "className is required" });

    const { error } = await supabase
      .from('fee_structures')
      .upsert(
        { school_id: schoolId, class_name: className, term, tuition, activity, misc },
        { onConflict: 'school_id,class_name,term' }
      );

    if (error) throw error;
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

// ─── POST record manual payment ──────────────────────────────────────────────
router.post("/", requireRoles("admin", "finance", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      studentId,
      amount,
      feeType      = "tuition",
      paymentMethod = "cash",
      referenceNumber = null,
      paymentDate,
      status       = "paid",
      term         = "Term 2",
      paidBy       = null,
    } = req.body;

    if (!studentId || !amount || !paymentDate)
      return res.status(400).json({ message: "studentId, amount and paymentDate are required" });

    const { data: inserted, error: insertError } = await supabase
      .from('payments')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        amount,
        fee_type: feeType,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        payment_date: paymentDate,
        status,
        term,
        paid_by: paidBy,
      })
      .select('payment_id')
      .single();

    if (insertError) throw insertError;
    const paymentId = inserted.payment_id;

    // ── Email notification (fire-and-forget) ──
    if (isEmailConfigured()) {
      try {
        const { data: studentRow } = await supabase
          .from('students')
          .select('first_name, last_name, parent_name')
          .eq('student_id', studentId)
          .eq('school_id', schoolId)
          .eq('is_deleted', false)
          .limit(1)
          .single();

        const { data: userRow } = await supabase
          .from('users')
          .select('email')
          .eq('student_id', studentId)
          .eq('role', 'parent')
          .eq('is_deleted', false)
          .limit(1)
          .single();

        if (studentRow && userRow?.email) {
          sendEmail({
            to: userRow.email,
            subject: `Payment Received — ${term}`,
            html: templates.paymentReceived({
              parentName:  studentRow.parent_name || "Parent/Guardian",
              studentName: `${studentRow.first_name} ${studentRow.last_name}`,
              amount, term, balance: null,
            }),
            schoolId,
          }).catch(() => {});
        }
      } catch (_) {}
    }

    logActivity(req, { action:"payment.create", entity:"payment", entityId:paymentId, description:`KES ${amount} recorded for student ${studentId}` });

    await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_CREATE, {
      entityId: paymentId,
      entityType: 'payment',
      description: `Payment recorded: KES ${amount} for student ${studentId} (${feeType})`,
      newValues: { studentId, amount, feeType, paymentMethod, referenceNumber, paymentDate, status, term, paidBy }
    });

    res.status(201).json({ paymentId });
  } catch (err) { next(err); }
});

// ─── PUT update payment ───────────────────────────────────────────────────────
router.put("/:id", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { amount, feeType, paymentMethod, referenceNumber, paymentDate, status, paidBy } = req.body;

    const { data: updated, error } = await supabase
      .from('payments')
      .update({
        amount,
        fee_type: feeType,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        payment_date: paymentDate,
        status: status || 'paid',
        paid_by: paidBy || null,
      })
      .eq('payment_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('payment_id')
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Payment not found" });

    await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_UPDATE, {
      entityId: req.params.id,
      entityType: 'payment',
      description: `Payment updated: ID ${req.params.id} - KES ${amount} (${status})`,
      newValues: { amount, feeType, paymentMethod, referenceNumber, paymentDate, status, paidBy }
    });

    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE payment ───────────────────────────────────────────────────────────
router.delete("/:id", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: deleted, error } = await supabase
      .from('payments')
      .update({ is_deleted: true })
      .eq('payment_id', req.params.id)
      .eq('school_id', schoolId)
      .select('payment_id')
      .single();

    if (error) throw error;
    if (!deleted) return res.status(404).json({ message: "Payment not found" });

    await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_DELETE, {
      entityId: req.params.id,
      entityType: 'payment',
      description: `Payment deleted: ID ${req.params.id}`
    });

    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
