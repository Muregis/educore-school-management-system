import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { sendEmail, isEmailConfigured, templates } from "../services/email.service.js";
import { logActivity } from "../helpers/activity.logger.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
import { env } from "../config/env.js";
import { sendWhatsAppPaymentReceipt } from "../services/whatsappService.js";
import { LedgerService } from "../services/ledger.service.js";
import { getPortalStudentIds } from "../utils/portalAccess.js";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

const router = Router();
router.use(authRequired);

// ─── GET all payments (with student name) ────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const { term } = req.query;

    let query = supabase
      .from('payments')
      .select('payment_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, paid_by, term, proof_url, school_id, is_deleted')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (term) {
      query = query.eq('term', term);
    }

    const { data: rows, error } = await query
      .order('payment_date', { ascending: false })
      .order('payment_id', { ascending: false });

    if (error) throw error;

    const payments = rows || [];
    const studentIds = [...new Set(payments.map(p => p.student_id).filter(Boolean))];

    let studentsMap = new Map();
    if (studentIds.length) {
      const { data: students } = await supabase
        .from('students')
        .select('student_id, first_name, last_name, class_name, admission_number, parent_phone, parent_name')
        .in('student_id', studentIds);

      studentsMap = new Map((students || []).map(s => [s.student_id, s]));
    }

    const result = payments.map(p => {
      const student = studentsMap.get(p.student_id) || {};
      return {
        ...p,
        first_name: student.first_name ?? null,
        last_name: student.last_name ?? null,
        class_name: student.class_name ?? null,
        admission_number: student.admission_number ?? null,
        parent_phone: student.parent_phone ?? null,
        parent_name: student.parent_name ?? null,
        students: undefined,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ─── GET fee structures ───────────────────────────────────────────────────────
router.get("/fee-structures", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term } = req.query;

    let query = supabase
      .from('fee_structures')
      .select('fee_structure_id, class_name, term, tuition, activity, misc')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (term) {
      query = query.eq('term', term);
    }

    const { data: rows, error } = await query.order('class_name');

    if (error) throw error;

    const result = [];
    for (const fs of (rows || [])) {
      const { data: items } = await supabase
        .from('fee_items')
        .select('item_type, amount')
        .eq('fee_structure_id', fs.fee_structure_id)
        .eq('is_optional', false);

      const itemTotals = { tuition: 0, activity: 0, misc: 0 };
      for (const item of (items || [])) {
        const t = item.item_type;
        if (t === 'tuition' || t === 'activity' || t === 'misc') {
          itemTotals[t] += Number(item.amount) || 0;
        }
      }

      result.push({
        ...fs,
        tuition: Number(fs.tuition) || itemTotals.tuition || 0,
        activity: Number(fs.activity) || itemTotals.activity || 0,
        misc: Number(fs.misc) || itemTotals.misc || 0,
      });
    }

    res.json(result);
  } catch (err) { next(err); }
});

// ─── POST fee structure ───────────────────────────────────────────────────────
router.post("/fee-structures", requireRoles("admin", "finance", "director", "superadmin"), async (req, res, next) => {
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
      parentPhone,
      proofUrl
    } = req.body;

    if (!studentId || !amount || !paymentDate)
      return res.status(400).json({ message: "studentId, amount and paymentDate are required" });

    // FIX: Validate amount sensibly - no phantom fees table check
    if (Number(amount) <= 0)
      return res.status(400).json({ message: "Amount must be greater than 0" });

    // Verify student belongs to this school
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, parent_phone')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentErr || !student)
      return res.status(404).json({ message: "Student not found" });

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
        proof_url: proofUrl || null
      })
      .select('payment_id')
      .single();

    if (insertError) throw insertError;
    const paymentId = inserted.payment_id;

    // Update student ledger balance
    try {
      const ledgerResult = await LedgerService.recordPayment(schoolId, studentId, Number(amount), `${feeType} payment`, paymentId, req);
      if (!ledgerResult?.ledgerId) {
        console.warn('Payment recorded but ledger balance was not updated (student_ledger table may be missing)');
      }
    } catch (ledgerErr) {
      console.error('Failed to update ledger:', ledgerErr);
      // Don't fail the payment if ledger update fails
    }

    // Email notification (fire-and-forget)
    if (isEmailConfigured()) {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('email')
          .eq('school_id', schoolId)
          .eq('student_id', studentId)
          .eq('role', 'parent')
          .eq('is_deleted', false)
          .limit(1)
          .single();

        if (student && userRow?.email) {
          sendEmail({
            to: userRow.email,
            subject: `Payment Received — ${term}`,
            html: templates.paymentReceived({
              parentName:  student.parent_name || "Parent/Guardian",
              studentName: `${student.first_name} ${student.last_name}`,
              amount, term, balance: 0,
            }),
            schoolId,
          }).catch(() => {});
        }
      } catch (_) {}
    }

    // WhatsApp receipt (if parentPhone provided)
    const recipientPhone = parentPhone || student.parent_phone;
    if (recipientPhone) {
      try {
        await sendWhatsAppPaymentReceipt({
          schoolId,
          recipientPhone,
          amount,
          reference: referenceNumber || paymentId,
          studentName: `${student.first_name} ${student.last_name}`,
        });
      } catch (smsErr) {
        console.error('WhatsApp receipt failed:', smsErr.message);
      }
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
router.put("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { amount, feeType, paymentMethod, referenceNumber, paymentDate, status, paidBy } = req.body;

    // Fetch the original payment to get student_id and old amount
    const { data: originalPayment, error: fetchError } = await supabase
      .from('payments')
      .select('payment_id, student_id, amount')
      .eq('payment_id', req.params.id)
      .eq('school_id', schoolId)
      .single();

    if (fetchError || !originalPayment) {
      return res.status(404).json({ message: "Payment not found" });
    }

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

    // Sync ledger: reverse old payment, record new one
    try {
      const { data: currentEntries } = await supabase
        .from('student_ledger')
        .select('balance_after, ledger_id')
        .eq('reference_type', 'payment')
        .eq('reference_id', req.params.id)
        .eq('school_id', schoolId)
        .order('ledger_id', { ascending: false })
        .limit(1);

      const oldEntry = currentEntries?.[0];
      if (oldEntry) {
        // Delete the old ledger entry
        await supabase
          .from('student_ledger')
          .delete()
          .eq('ledger_id', oldEntry.ledger_id);
      }

      // Record new payment in ledger
      await LedgerService.recordPayment(
        schoolId,
        originalPayment.student_id,
        Number(amount),
        `Payment updated – ${feeType || 'tuition'}`,
        req.params.id,
        req
      );
    } catch (ledgerErr) {
      console.error('Failed to sync ledger on payment update:', ledgerErr);
    }

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
router.delete("/:id", requireRoles("director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: deleted, error } = await supabase
      .from('payments')
      .update({ is_deleted: true })
      .eq('payment_id', req.params.id)
      .eq('school_id', schoolId)
      .select('payment_id, student_id, amount')
      .single();

    if (error) throw error;
    if (!deleted) return res.status(404).json({ message: "Payment not found" });

    // Reverse the ledger entry for this payment
    try {
      const { data: ledgerEntry } = await supabase
        .from('student_ledger')
        .select('ledger_id')
        .eq('reference_type', 'payment')
        .eq('reference_id', req.params.id)
        .eq('school_id', schoolId)
        .order('ledger_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ledgerEntry) {
        await supabase
          .from('student_ledger')
          .delete()
          .eq('ledger_id', ledgerEntry.ledger_id);
      }
    } catch (ledgerErr) {
      console.error('Failed to remove ledger entry on payment delete:', ledgerErr);
    }

    await logAuditEvent(req, AUDIT_ACTIONS.PAYMENT_DELETE, {
      entityId: req.params.id,
      entityType: 'payment',
      description: `Payment deleted: ID ${req.params.id}`,
    });

    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ─── POST record manual payment (Cash, Bank Transfer, M-Pesa Manual) ───────
router.post("/record-manual", authRequired, requireRoles('admin', 'finance', 'director', 'superadmin'), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const body = req.body || {};
    const studentId = body.studentId ?? body.student_id;
    const amount = body.amount;
    const paymentMethod = body.paymentMethod ?? body.payment_method;
    const referenceNumber = body.referenceNumber ?? body.reference_number;
    const bankName = body.bankName ?? body.bank_name;
    const accountNumber = body.accountNumber ?? body.account_number;
    const mpesaCode = body.mpesaCode ?? body.mpesa_code;
    const mpesaPhone = body.mpesaPhone ?? body.mpesa_phone;
    const proofUrl = body.proofUrl ?? body.proof_url;
    const paymentDate = body.paymentDate ?? body.payment_date;
    const notes = body.notes;
    const term = body.term;

    console.log('[PAYMENT] record-manual body:', {
      studentId,
      amount,
      paymentMethod,
      schoolId,
      userId,
      keys: Object.keys(body)
    });

    const numericStudentId = studentId !== undefined && studentId !== null && studentId !== '' ? Number(studentId) : NaN;
    const numericAmount = amount !== undefined && amount !== null ? Number(amount) : NaN;

    if (!Number.isFinite(numericStudentId) || numericStudentId <= 0) {
      return res.status(400).json({
        message: 'studentId is required and must be a valid positive number',
        received: { studentId, numericStudentId }
      });
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: 'amount is required and must be a valid positive number',
        received: { amount, numericAmount }
      });
    }

    const normalizedPaymentMethod = String(paymentMethod || '').trim().toLowerCase();
    if (!normalizedPaymentMethod) {
      return res.status(400).json({
        message: 'paymentMethod is required',
        received: { paymentMethod }
      });
    }

    if (['mpesa_manual', 'mpesa'].includes(normalizedPaymentMethod) && !mpesaCode) {
      return res.status(400).json({
        message: 'M-Pesa transaction code is required'
      });
    }

    if (['bank_transfer', 'bank'].includes(normalizedPaymentMethod) && !referenceNumber) {
      return res.status(400).json({
        message: 'Bank reference number is required'
      });
    }

    console.log('[PAYMENT] record-manual request:', {
      studentId,
      numericStudentId,
      amount,
      paymentMethod,
      schoolId,
      userId
    });

    if (!Number.isFinite(numericStudentId) || numericStudentId <= 0) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    let student = null;
    let studentErr = null;

    try {
      const result = await supabase
        .from('students')
        .select('student_id, first_name, last_name, parent_phone')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .eq('student_id', numericStudentId)
        .maybeSingle();

      student = result.data;
      studentErr = result.error;
    } catch (lookupError) {
      console.error('[PAYMENT] Student lookup error:', lookupError);
      studentErr = lookupError;
    }

    console.log('[PAYMENT] Student lookup result:', { student: student?.student_id, error: studentErr?.message });

    if (studentErr || !student) {
      return res.status(404).json({ message: 'Student not found in this school' });
    }

    const receiptNumber = normalizedPaymentMethod === 'cash'
      ? (referenceNumber ? `CASH-${referenceNumber}` : `CASH-${Date.now()}`)
      : ['bank_transfer', 'bank'].includes(normalizedPaymentMethod)
      ? `BANK-${referenceNumber}`
      : `MPESA-${mpesaCode}`;

    const { data, error } = await supabase
      .from('payments')
      .insert({
        school_id: schoolId,
        student_id: numericStudentId,
        amount: numericAmount,
        payment_method: normalizedPaymentMethod,
        reference_number: receiptNumber,
        bank_name: bankName || null,
        account_number: accountNumber || null,
        mpesa_code: mpesaCode || null,
        mpesa_phone: mpesaPhone || null,
        proof_url: proofUrl || null,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        status: 'paid',
        term: term || 'Term 2',
        received_by_user_id: userId,
        notes: notes || null,
        created_at: new Date().toISOString()
      })
      .select('payment_id, reference_number')
      .single();

    if (error) {
      console.error('Payment insert error:', error);
      return res.status(400).json({
        message: error.message || 'Failed to record payment'
      });
    }

    try {
      await LedgerService.recordPayment(schoolId, numericStudentId, numericAmount, `Payment recorded via ${normalizedPaymentMethod}`, data.payment_id, req);
    } catch (ledgerErr) {
      console.error('Ledger update error:', ledgerErr);
    }

    res.status(201).json({
      success: true,
      paymentId: data.payment_id,
      receiptNumber: data.reference_number,
      studentId: numericStudentId,
      amount: numericAmount,
      paymentMethod: normalizedPaymentMethod,
      date: paymentDate || new Date().toISOString().split('T')[0],
      message: `${normalizedPaymentMethod} payment of KES ${numericAmount} recorded successfully`
    });

  } catch (err) {
    console.error('Record manual payment error:', err);
    next(err);
  }
});

// ─── POST upload proof of payment ────────────────────────────────────────────
router.post("/upload-proof", requireRoles("admin", "finance", "teacher"), upload.single('file'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const { studentId, amount } = req.body;
    
    if (!studentId || !amount) {
      return res.status(400).json({ message: "Student ID and amount are required" });
    }
    
    const file = req.file;
    const timestamp = Date.now();
    const fileExt = file.originalname.split('.').pop();
    const filename = `payment-proof-${studentId}-${timestamp}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filename);
    
    logActivity(req, { 
      action:"payment.proof_uploaded", 
      entity:"payment", 
      description:`Payment proof uploaded for student ${studentId}, amount ${amount}` 
    });
    
    res.json({ 
      proofUrl: publicUrl,
      filename: filename
    });
    
  } catch (err) { 
    next(err); 
  }
});

export default router;
