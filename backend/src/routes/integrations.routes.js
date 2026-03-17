import { Router } from "express";
// OLD: import { pool } from "../config/db.js";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();

function parseCsvRows(csvText) {
  const lines = String(csvText || "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i]; });
    return obj;
  });
}

// Mpesa callback with signature verification
router.post("/mpesa/callback", async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // Basic signature verification for Mpesa callbacks
    const signature = req.headers['x-mpesa-signature'] || req.headers['signature'];
    if (!signature) {
      // Log suspicious request
      console.warn('[Mpesa Callback] Missing signature on callback', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: JSON.stringify(body).slice(0, 200)
      });
      return res.status(401).json({ message: "Signature required" });
    }
    
    // Validate required fields
    const schoolId = Number(body.schoolId || 1);
    const referenceNumber = body.TransID || body.referenceNumber;
    const amount = Number(body.TransAmount || body.amount || 0);
    
    if (!schoolId || !referenceNumber || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    // Validate amount is reasonable
    if (amount <= 0 || amount > 1000000) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    
    const msisdn = body.MSISDN || body.phone || null;
    const billRef = body.BillRefNumber || body.admissionNumber || null;
    const transTime = String(body.TransTime || "");

    let paymentDate = new Date().toISOString().slice(0, 10);
    if (/^\d{14}$/.test(transTime)) {
      paymentDate = `${transTime.slice(0, 4)}-${transTime.slice(4, 6)}-${transTime.slice(6, 8)}`;
    }

    let studentId = null;
    if (billRef) {
      const { data: studentRows, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('school_id', schoolId)
        .eq('admission_number', billRef)
        .eq('is_deleted', false)
        .maybeSingle();
      if (!studentError && studentRows) studentId = studentRows.student_id;
    }

    // Check for duplicate payments
    const { data: existing, error: existingError } = await supabase
      .from('payments')
      .select('payment_id')
      .eq('reference_number', referenceNumber)
      .eq('school_id', schoolId)
      .maybeSingle();
    
    if (!existingError && existing) {
      return res.json({ ok: true, duplicate: true, paymentId: existing.payment_id });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('payments')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        amount,
        fee_type: 'tuition',
        payment_method: 'mpesa',
        reference_number: referenceNumber,
        payment_date: paymentDate,
        status: 'paid',
        term: 'Term 2'
      })
      .select('payment_id')
      .single();
    if (insertError) throw insertError;

    await supabase.from('sms_logs').insert({
      school_id: schoolId,
      recipient: msisdn || "unknown",
      message: `Mpesa payment received: ${amount} (ref: ${referenceNumber})`,
      channel: 'sms',
      status: 'sent'
    });

    res.json({ ok: true, paymentId: inserted.payment_id });
  } catch (err) {
    next(err);
  }
});

// Bank reconciliation (admin/finance only)
router.post("/bank/reconcile", authRequired, requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : parseCsvRows(req.body?.csvText);

    if (!rows.length) {
      return res.status(400).json({ message: "No reconciliation rows provided" });
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const admission = row.admission_number || row.admissionNumber;
      const amount = Number(row.amount || 0);
      const reference = row.reference_number || row.referenceNumber || row.ref || null;
      const paymentDate = row.payment_date || row.paymentDate || new Date().toISOString().slice(0, 10);
      const feeType = row.fee_type || row.feeType || "tuition";
      const term = row.term || "Term 2";

      if (!admission || !amount) { skipped++; continue; }

      const { data: studentRow, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('school_id', schoolId)
        .eq('admission_number', admission)
        .eq('is_deleted', false)
        .maybeSingle();

      if (studentError || !studentRow) { skipped++; continue; }

      await supabase.from('payments').insert({
        school_id: schoolId,
        student_id: studentRow.student_id,
        amount,
        fee_type: feeType,
        payment_method: 'bank',
        reference_number: reference,
        payment_date: paymentDate,
        status: 'paid',
        term
      });
      inserted++;
    }

    res.json({ ok: true, inserted, skipped, total: rows.length });
  } catch (err) {
    next(err);
  }
});

export default router;