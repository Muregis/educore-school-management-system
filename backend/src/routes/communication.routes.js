import { Router } from "express";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { sendEmail, sendBulkEmail, isEmailConfigured, templates } from "../services/email.service.js";
import { supabase } from "../config/supabaseClient.js";

const router = Router();
router.use(authRequired);

// ─── Africa's Talking SMS sender ─────────────────────────────────────────────
async function sendViaSms(recipients, message, schoolId, sentByUserId = null) {
  const logs = [];

  if (env.atApiKey && env.atUsername) {
    try {
      const params = new URLSearchParams({
        username: env.atUsername,
        to:       recipients.join(","),
        message,
        from:     env.atSenderId || "EduCore",
      });

      const response = await fetch("https://api.africastalking.com/version1/messaging", {
        method:  "POST",
        headers: {
          "apiKey":        env.atApiKey,
          "Content-Type":  "application/x-www-form-urlencoded",
          "Accept":        "application/json",
        },
        body: params.toString(),
      });

      const result = await response.json();
      console.log("AT SMS response:", JSON.stringify(result));

      const atRecipients = result?.SMSMessageData?.Recipients || [];

      for (const r of atRecipients) {
        const status = r.status === "Success" ? "sent" : "failed";
        await supabase.from('sms_logs').insert({
          school_id: schoolId,
          recipient: r.number,
          message,
          channel: 'sms',
          status,
          sent_by_user_id: sentByUserId,
          provider_response: JSON.stringify(r)
        });
        logs.push({ phone: r.number, status });
      }

      // Log any recipients AT didn't return
      const atNumbers = atRecipients.map(r => r.number);
      for (const phone of recipients) {
        if (!atNumbers.includes(phone)) {
          await supabase.from('sms_logs').insert({
            school_id: schoolId,
            recipient: phone,
            message,
            channel: 'sms',
            status: 'failed',
            sent_by_user_id: sentByUserId
          });
          logs.push({ phone, status: "failed" });
        }
      }

      return {
        sent:       logs.filter(l => l.status === "sent").length,
        failed:     logs.filter(l => l.status === "failed").length,
        logs,
      };
    } catch (err) {
      console.error("AT SMS error:", err.message);
    }
  }

  // Fallback — queued (AT not configured)
  for (const phone of recipients) {
    await supabase.from('sms_logs').insert({
      school_id: schoolId,
      recipient: phone,
      message,
      channel: 'sms',
      status: 'queued',
      sent_by_user_id: sentByUserId
    });
    logs.push({ phone, status: "queued" });
  }
  return { sent: 0, failed: 0, queued: logs.length, logs };
}

// ─── GET AT config status (admin only) ───────────────────────────────────────
router.get("/sms-status", async (req, res) => {
  res.json({
    atConfigured: Boolean(env.atApiKey && env.atUsername),
    username: env.atUsername || null,
    senderId: env.atSenderId || null,
    hasApiKey: Boolean(env.atApiKey),
  });
});

// ─── GET sms logs ─────────────────────────────────────────────────────────────
router.get("/sms-logs", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: rows, error } = await supabase
      .from('sms_logs')
      .select('sms_id, recipient, message, channel, status, sent_at, provider_response')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('sent_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    return res.json(rows || []);
  } catch (err) { next(err); }
});

// ─── POST single SMS ──────────────────────────────────────────────────────────
router.post("/sms", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { recipient, message } = req.body;
    if (!recipient || !message)
      return res.status(400).json({ message: "recipient and message are required" });

    const result = await sendViaSms([recipient], message, schoolId, userId);
    res.status(201).json({ ...result, message: "SMS sent" });
  } catch (err) { next(err); }
});

// ─── POST bulk SMS to class ───────────────────────────────────────────────────
router.post("/sms/bulk", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className, message } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    let q = supabase
      .from("students")
      .select("parent_phone")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .not("parent_phone", "is", null);
    if (className && className !== "all") {
      q = q.eq("class_name", className);
    }
    const { data: studentRows, error: studentsErr } = await q;
    if (studentsErr) throw studentsErr;

    const phones = [...new Set(
      (studentRows || [])
        .map(r => (r?.parent_phone ?? "").trim())
        .filter(Boolean)
    )];
    if (!phones.length) {
      return res.status(404).json({ message: "No parent phone numbers found for this class" });
    }

    const result = await sendViaSms(phones, message, schoolId, userId);

    res.json({ ...result, total: phones.length, recipients: phones });
  } catch (err) { next(err); }
});

// ─── PATCH sms log status ─────────────────────────────────────────────────────
router.patch("/sms-logs/:id/status", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.body;
    const { error } = await supabase
      .from('sms_logs')
      .update({ status })
      .eq('sms_id', req.params.id)
      .eq('school_id', schoolId);
    if (error) throw error;
    res.json({ updated: true });
  } catch (err) { next(err); }
});


// ── GET email config status ───────────────────────────────────────────────────
router.get("/email-status", async (req, res) => {
  res.json({
    configured: isEmailConfigured(),
    from: process.env.SMTP_FROM || null,
    host: process.env.SMTP_HOST || null,
  });
});

// ── POST send single email ────────────────────────────────────────────────────
router.post("/email", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { to, subject, message, recipientName } = req.body;
    if (!to || !subject || !message)
      return res.status(400).json({ message: "to, subject and message are required" });

    const html = templates.custom({ recipientName: recipientName || "Parent/Guardian", subject, message });
    const result = await sendEmail({ to, subject, html, schoolId, sentByUserId: userId });
    res.status(201).json({ ...result, message: "Email sent" });
  } catch (err) { next(err); }
});

// ── POST bulk email to class ──────────────────────────────────────────────────
router.post("/email/bulk", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className, subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: "subject and message are required" });

    let q = supabase
      .from('students')
      .select('student_id, first_name, last_name, parent_name, class_name, users!inner(email, role, is_deleted)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('users.role', 'parent')
      .eq('users.is_deleted', false)
      .not('users.email', 'is', null);
    if (className && className !== "all") {
      q = q.eq('class_name', className);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    
    if (!rows?.length) return res.status(404).json({ message: "No email addresses found for this class" });

    const recipients = rows.map(r => ({
      email: r.users?.email,
      name:  r.parent_name || `${r.first_name} ${r.last_name}`,
    })).filter(r => r.email);

    const result = await sendBulkEmail({
      recipients, subject,
      htmlFn: (r) => templates.custom({ recipientName: r.name, subject, message }),
      schoolId, sentByUserId: userId,
    });

    res.json({ ...result, message: `Email sent to ${result.total} recipients` });
  } catch (err) { next(err); }
});

// ── POST fee reminder email to defaulters ─────────────────────────────────────
router.post("/email/fee-reminder", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className } = req.body;

    // Find parents with outstanding balances who have emails
    // OLD: Complex SQL query replaced with Supabase query + in-memory calculation
    // Get students with parent users
    let studentQuery = supabase
      .from('students')
      .select('student_id, first_name, last_name, parent_name, class_name, users!inner(email, role, is_deleted)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('users.role', 'parent')
      .eq('users.is_deleted', false)
      .not('users.email', 'is', null);
    if (className && className !== "all") {
      studentQuery = studentQuery.eq('class_name', className);
    }
    const { data: students, error: studentError } = await studentQuery;
    if (studentError) throw studentError;
    
    // Get invoices for these students
    const studentIds = (students || []).map(s => s.student_id);
    if (!studentIds.length) {
      return res.json({ message: "No fee defaulters with email found", sent: 0 });
    }
    
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('invoice_id, student_id, amount_due')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .in('student_id', studentIds);
    if (invoiceError) throw invoiceError;
    
    // Get payments for these invoices
    const invoiceIds = (invoices || []).map(i => i.invoice_id);
    let payments = [];
    if (invoiceIds.length) {
      const { data: paymentData } = await supabase
        .from('payments')
        .select('invoice_id, amount')
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .in('invoice_id', invoiceIds);
      payments = paymentData || [];
    }
    
    // Calculate balances per student
    const invoiceMap = {};
    for (const inv of invoices || []) {
      invoiceMap[inv.invoice_id] = inv;
      if (!inv.studentBalance) inv.studentBalance = 0;
      inv.studentBalance += Number(inv.amount_due || 0);
    }
    for (const pay of payments) {
      const inv = invoiceMap[pay.invoice_id];
      if (inv) {
        inv.studentBalance -= Number(pay.amount || 0);
      }
    }
    
    const balanceByStudent = {};
    for (const inv of invoices || []) {
      balanceByStudent[inv.student_id] = (balanceByStudent[inv.student_id] || 0) + inv.studentBalance;
    }
    
    // Filter to defaulters only
    const defaulters = (students || [])
      .filter(s => balanceByStudent[s.student_id] > 0)
      .map(s => ({
        email: s.users?.email,
        name: s.parent_name || `${s.first_name} ${s.last_name}`,
        balance: balanceByStudent[s.student_id],
        studentName: `${s.first_name} ${s.last_name}`
      })).filter(d => d.email);
    
    if (!defaulters.length) return res.json({ message: "No fee defaulters with email found", sent: 0 });

    const subject = "Outstanding Fee Balance — Action Required";
    const result = await sendBulkEmail({
      recipients: defaulters,
      subject,
      htmlFn: (r) => templates.custom({
        recipientName: r.name, subject,
        message: `Your child ${r.studentName} has an outstanding fee balance of KES ${Number(r.balance).toLocaleString()}. Please log in to the parent portal to make payment or contact the school finance office.`,
      }),
      schoolId, sentByUserId: userId,
    });

    res.json({ ...result, message: `Fee reminder sent to ${result.total} parents` });
  } catch (err) { next(err); }
});

export default router;
