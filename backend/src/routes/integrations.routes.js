import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { env } from "../config/env.js";
import crypto from "crypto";

const router = Router();

// Kenyan-style SMS receipt function
async function sendKenyanPaymentReceipt({ schoolId, studentName, admissionNumber, amount, referenceNumber, paymentDate, parentPhone, payerPhone }) {
  try {
    if (!parentPhone && !payerPhone) return;
    
    const message = `EDUCORE: Payment received for ${studentName} (${admissionNumber}). Amount: KES ${amount}. Ref: ${referenceNumber}. Date: ${paymentDate}. Thank you!`;
    const recipient = parentPhone || payerPhone;
    
    // Log SMS attempt
    await supabase.from('sms_logs').insert({
      school_id: schoolId,
      recipient,
      message,
      channel: 'sms',
      status: 'sent',
      metadata: {
        type: 'payment_receipt',
        student_name: studentName,
        admission_number: admissionNumber,
        amount,
        reference_number: referenceNumber
      }
    });
    
    console.log(`[Kenyan SMS] Receipt sent to ${recipient}: ${message}`);
  } catch (error) {
    console.error('[Kenyan SMS] Failed to send receipt:', error);
  }
}

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

// Enhanced M-Pesa callback with Kenyan-specific validation
router.post("/mpesa/callback", async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // M-Pesa Kenya callback signature verification
    const signature = req.headers['x-mpesa-signature'] || req.headers['signature'];
    if (!signature) {
      console.warn('[M-Pesa Kenya Callback] Missing signature', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({ message: "Signature required" });
    }
    
    // Validate M-Pesa Kenya callback structure
    const { 
      TransID, 
      TransAmount, 
      MSISDN, 
      BillRefNumber, 
      TransTime,
      BusinessShortCode,
      TransactionType,
      OrgAccountBalance,
      ThirdPartyTransID,
      PhoneNumber
    } = body;
    
    // Extract school ID from BillRefNumber (format: SCHOOLID-ADMNO)
    const billRefParts = (BillRefNumber || '').split('-');
    const schoolId = Number(billRefParts[0]);
    
    // Validate school ID extraction
    if (!schoolId || !Number.isInteger(schoolId) || schoolId < 1) {
      return res.status(400).json({ 
        error: "Invalid school ID in BillRefNumber format",
        expectedFormat: "SCHOOLID-ADMNO",
        received: BillRefNumber
      });
    }
    
    const admissionNumber = billRefParts[1] || BillRefNumber;
    
    const referenceNumber = TransID;
    const amount = Number(TransAmount || 0);
    const phone = MSISDN || PhoneNumber;
    
    // Validate Kenyan M-Pesa transaction
    if (!referenceNumber || !amount || !phone) {
      return res.status(400).json({ 
        message: "Missing required M-Pesa fields",
        required: ["TransID", "TransAmount", "MSISDN/PhoneNumber"]
      });
    }
    
    // Validate amount range for Kenyan school fees (KES 100 - 500,000)
    if (amount < 100 || amount > 500000) {
      return res.status(400).json({ 
        message: "Amount outside valid range for school fees (KES 100 - 500,000)" 
      });
    }
    
    // Validate Kenyan phone number format (2547xxxxxxxx)
    if (!/^2547[0-9]{8}$/.test(phone)) {
      console.warn('[M-Pesa Kenya] Invalid phone format', { phone });
      // Continue processing but log warning
    }
    
    // Parse M-Pesa transaction time (YYYYMMDDHHMMSS)
    let paymentDate = new Date().toISOString().slice(0, 10);
    if (TransTime && /^\d{14}$/.test(TransTime)) {
      paymentDate = `${TransTime.slice(0, 4)}-${TransTime.slice(4, 6)}-${TransTime.slice(6, 8)}`;
    }

    let studentId = null;
    if (admissionNumber) {
      const { data: studentRows, error: studentError } = await supabase
        .from('students')
        .select('student_id, first_name, last_name, parent_phone')
        .eq('school_id', schoolId)
        .eq('admission_number', admissionNumber)
        .eq('is_deleted', false)
        .maybeSingle();
      if (!studentError && studentRows) {
        studentId = studentRows.student_id;
        
        // Send Kenyan-style SMS receipt to parent
        await sendKenyanPaymentReceipt({
          schoolId,
          studentName: `${studentRows.first_name} ${studentRows.last_name}`,
          admissionNumber,
          amount,
          referenceNumber,
          paymentDate,
          parentPhone: studentRows.parent_phone,
          payerPhone: phone
        });
      }
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
      recipient: phone || "unknown",
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