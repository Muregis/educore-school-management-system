/**
 * Fee Reminders Route
 * POST /api/fees/send-reminders
 *
 * Sends WhatsApp payment reminders to all parents with outstanding balances.
 * Safety rules:
 *  - Read-only balance computation (no DB writes except sms_logs)
 *  - dryRun=true returns list without sending
 *  - Requires admin or finance role
 *  - Logs every sent message to sms_logs for audit trail
 *  - Skips students with no parent phone (never errors, just counts skipped)
 */

import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { sendPaymentReceipt } from "../utils/smsUtils.js";

const router = Router();
router.use(authRequired);

// POST /api/fees/send-reminders
router.post("/send-reminders", requireRoles("admin", "finance", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term, dryRun = false } = req.body;

    if (!term) return res.status(400).json({ message: "term is required" });

    // 1. Load all active students (read-only)
    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, class_name, parent_phone, admission_number")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .eq("is_deleted", false);
    if (sErr) throw sErr;

    // 2. Load fee structures for this term (read-only)
    const { data: feeStructures, error: fErr } = await supabase
      .from("fee_structures")
      .select("class_name, tuition, activity, misc, term")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .eq("term", term);
    if (fErr) throw fErr;

    const feeByClass = new Map();
    for (const fs of (feeStructures || [])) {
      const total = Number(fs.tuition || 0) + Number(fs.activity || 0) + Number(fs.misc || 0);
      feeByClass.set(fs.class_name, total);
    }

    // 3. Load all paid payments for this term (read-only)
    const { data: payments, error: pErr } = await supabase
      .from("payments")
      .select("student_id, amount, status, term")
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("status", "paid")
      .eq("is_deleted", false);
    if (pErr) throw pErr;

    // Sum payments per student
    const paidByStudent = new Map();
    for (const p of (payments || [])) {
      const prev = paidByStudent.get(p.student_id) || 0;
      paidByStudent.set(p.student_id, prev + Number(p.amount || 0));
    }

    // 4. Compute defaulters
    const defaulters = [];
    for (const s of (students || [])) {
      const expected = feeByClass.get(s.class_name) || 0;
      if (expected <= 0) continue; // no fee structure for this class — skip
      const paid    = paidByStudent.get(s.student_id) || 0;
      const balance = expected - paid;
      if (balance <= 0) continue; // fully paid — skip

      defaulters.push({
        student_id:       s.student_id,
        name:             `${s.first_name} ${s.last_name}`.trim(),
        class_name:       s.class_name,
        parent_phone:     s.parent_phone || null,
        admission_number: s.admission_number || "",
        expected,
        paid,
        balance,
        hasPhone:         !!s.parent_phone,
      });
    }

    // Dry run — return preview, no messages sent
    if (dryRun || String(dryRun) === "true") {
      return res.json({
        dryRun:    true,
        term,
        total:     defaulters.length,
        withPhone: defaulters.filter(d => d.hasPhone).length,
        noPhone:   defaulters.filter(d => !d.hasPhone).length,
        defaulters,
      });
    }

    // 5. Send reminders (only to students with parent phone)
    let sent = 0, skipped = 0, failed = 0;
    for (const d of defaulters) {
      if (!d.parent_phone) { skipped++; continue; }

      try {
        // Build reminder message
        const msg = `Dear Parent, ${d.name} (${d.class_name}) has an outstanding fee balance of KES ${d.balance.toLocaleString()} for ${term}. Paid: KES ${d.paid.toLocaleString()} of KES ${d.expected.toLocaleString()}. Please pay via Mpesa or contact the school office. Ref: ${d.admission_number}`;

        // Send via existing WhatsApp/SMS utility (non-fatal if fails)
        await sendPaymentReceipt(schoolId, d.parent_phone, d.balance, "REMINDER", d.name);

        // Log to sms_logs for audit trail
        await supabase.from("sms_logs").insert({
          school_id:  schoolId,
          recipient:  d.parent_phone,
          message:    msg,
          channel:    "whatsapp",
          status:     "sent",
          student_id: d.student_id,
        }).then(() => {}).catch(() => {}); // non-fatal

        sent++;
      } catch (_) {
        failed++;
      }
    }

    res.json({
      term,
      total:   defaulters.length,
      sent,
      skipped, // no phone number on record
      failed,
      message: `${sent} reminder(s) sent for ${term}.`,
    });
  } catch (err) { next(err); }
});

export default router;
