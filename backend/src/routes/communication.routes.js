import { Router } from "express";
// OLD: import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { sendEmail, sendBulkEmail, isEmailConfigured, templates } from "../services/email.service.js";
import { supabase } from "../config/supabaseClient.js";
// OLD: import { sendWhatsAppMessage, sendBulkWhatsAppMessages, getWhatsAppConfigStatus } from "../services/whatsappService.js";
import { prepareWhatsAppMessage } from "../utils/whatsappLinks.js";
import { buildWaMeLink } from "../utils/whatsappLinks.js";

const router = Router();
router.use(authRequired);

async function sendViaWhatsApp(recipients, message, schoolId, sentByUserId = null) {
  const uniqueRecipients = [...new Set(recipients.filter(Boolean))];
  const preparedResults = await Promise.allSettled(
    uniqueRecipients.map(async (phone) => {
      const prepared = await prepareWhatsAppMessage({
        schoolId,
        recipientPhone: phone,
        message,
        sentByUserId,
      });

      return {
        phone,
        status: prepared.status,
        waLink: prepared.waLink,
      };
    })
  );

  const logs = preparedResults.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      phone: uniqueRecipients[index],
      status: "failed",
      waLink: null,
    };
  });

  return {
    sent: 0,
    failed: logs.filter(log => log.status === "failed").length,
    queued: logs.filter(log => log.status === "queued").length,
    logs,
    links: logs.filter(log => log.waLink),
  };
}

router.get("/sms-status", async (req, res) => {
  const { schoolId } = req.user;
  const { data: school, error } = await supabase
    .from("schools")
    .select("whatsapp_business_number")
    .eq("school_id", schoolId)
    .single();

  if (error || !school?.whatsapp_business_number) {
    return res.json({
      disabled: true,
      configured: false,
      message: "WhatsApp Business number not configured. Please set it in School Settings."
    });
  }

  res.json({
    disabled: false,
    configured: true,
    number: school.whatsapp_business_number,
    message: "WhatsApp Business is configured"
  });
});

// Single WhatsApp message
router.post("/whatsapp", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { recipient, message } = req.body;
    if (!recipient || !message) {
      return res.status(400).json({ message: "recipient and message are required" });
    }

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("name, whatsapp_business_number")
      .eq("school_id", schoolId)
      .single();
    if (schoolError) throw schoolError;
    if (!school?.whatsapp_business_number) {
      return res.status(400).json({ message: "Configure the school WhatsApp Business number first" });
    }

    const schoolName = school?.name || "EduCore";
    const enhancedMessage = `*${schoolName}*\n\n${message}\n\n_Sent from the school's WhatsApp Business line_`;
    const result = await sendViaWhatsApp([recipient], enhancedMessage, schoolId, userId);

    res.status(201).json({
      ...result,
      waLink: result.links?.[0]?.waLink || null,
      message: "WhatsApp chat prepared",
    });
  } catch (err) { next(err); }
});

// Bulk WhatsApp messages
router.post("/whatsapp/bulk", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className, message } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("name, whatsapp_business_number")
      .eq("school_id", schoolId)
      .single();
    if (schoolError) throw schoolError;
    if (!school?.whatsapp_business_number) {
      return res.status(400).json({ message: "Configure the school WhatsApp Business number first" });
    }

    const schoolName = school?.name || "EduCore";
    const enhancedMessage = `*${schoolName}*\n\n${message}\n\n_Sent from the school's WhatsApp Business line_`;

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

    // Fast path for bulk mode: build wa.me links without per-recipient logging to avoid timeouts on large classes.
    const links = phones
      .map(phone => ({ phone, waLink: buildWaMeLink(phone, enhancedMessage) }))
      .filter(item => item.waLink);

    const result = {
      sent: 0,
      failed: phones.length - links.length,
      queued: links.length,
      logs: links.map(item => ({
        phone: item.phone,
        status: "queued",
        waLink: item.waLink,
      })),
      links,
    };

    res.json({
      ...result,
      total: phones.length,
      recipients: phones,
      message: `Prepared ${result.queued} WhatsApp chats`,
    });
  } catch (err) { next(err); }
});

router.get("/email-status", async (req, res) => {
  res.json({
    configured: isEmailConfigured(),
    from: process.env.SMTP_FROM || null,
    host: process.env.SMTP_HOST || null,
  });
});

router.post("/email", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { to, subject, message, recipientName } = req.body;
    if (!to || !subject || !message) {
      return res.status(400).json({ message: "to, subject and message are required" });
    }

    const html = templates.custom({ recipientName: recipientName || "Parent/Guardian", subject, message });
    const result = await sendEmail({ to, subject, html, schoolId, sentByUserId: userId });
    res.status(201).json({ ...result, message: "Email sent" });
  } catch (err) { next(err); }
});

router.post("/email/bulk", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className, subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: "subject and message are required" });

    let q = supabase
      .from("students")
      .select("student_id, first_name, last_name, parent_name, class_name, users!inner(email, role, is_deleted)")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .eq("users.role", "parent")
      .eq("users.is_deleted", false)
      .not("users.email", "is", null);
    if (className && className !== "all") {
      q = q.eq("class_name", className);
    }
    const { data: rows, error } = await q;
    if (error) throw error;

    if (!rows?.length) return res.status(404).json({ message: "No email addresses found for this class" });

    const recipients = rows.map(r => ({
      email: r.users?.email,
      name: r.parent_name || `${r.first_name} ${r.last_name}`,
    })).filter(r => r.email);

    const result = await sendBulkEmail({
      recipients,
      subject,
      htmlFn: (r) => templates.custom({ recipientName: r.name, subject, message }),
      schoolId,
      sentByUserId: userId,
    });

    res.json({ ...result, message: `Email sent to ${result.total} recipients` });
  } catch (err) { next(err); }
});

router.post("/email/fee-reminder", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className } = req.body;

    let studentQuery = supabase
      .from("students")
      .select("student_id, first_name, last_name, parent_name, class_name, users!inner(email, role, is_deleted)")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .eq("users.role", "parent")
      .eq("users.is_deleted", false)
      .not("users.email", "is", null);
    if (className && className !== "all") {
      studentQuery = studentQuery.eq("class_name", className);
    }
    const { data: students, error: studentError } = await studentQuery;
    if (studentError) throw studentError;

    const studentIds = (students || []).map(s => s.student_id);
    if (!studentIds.length) {
      return res.json({ message: "No fee defaulters with email found", sent: 0 });
    }

    const { data: invoices, error: invoiceError } = await supabase
      .from("invoices")
      .select("invoice_id, student_id, amount_due")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .in("student_id", studentIds);
    if (invoiceError) throw invoiceError;

    const invoiceIds = (invoices || []).map(i => i.invoice_id);
    let payments = [];
    if (invoiceIds.length) {
      const { data: paymentData } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .in("invoice_id", invoiceIds);
      payments = paymentData || [];
    }

    const invoiceMap = {};
    for (const inv of invoices || []) {
      invoiceMap[inv.invoice_id] = inv;
      if (!inv.studentBalance) inv.studentBalance = 0;
      inv.studentBalance += Number(inv.amount_due || 0);
    }
    for (const pay of payments) {
      const inv = invoiceMap[pay.invoice_id];
      if (inv) inv.studentBalance -= Number(pay.amount || 0);
    }

    const balanceByStudent = {};
    for (const inv of invoices || []) {
      balanceByStudent[inv.student_id] = (balanceByStudent[inv.student_id] || 0) + inv.studentBalance;
    }

    const defaulters = (students || [])
      .filter(s => balanceByStudent[s.student_id] > 0)
      .map(s => ({
        email: s.users?.email,
        name: s.parent_name || `${s.first_name} ${s.last_name}`,
        balance: balanceByStudent[s.student_id],
        studentName: `${s.first_name} ${s.last_name}`,
      })).filter(d => d.email);

    if (!defaulters.length) return res.json({ message: "No fee defaulters with email found", sent: 0 });

    const subject = "Outstanding Fee Balance - Action Required";
    const result = await sendBulkEmail({
      recipients: defaulters,
      subject,
      htmlFn: (r) => templates.custom({
        recipientName: r.name,
        subject,
        message: `Your child ${r.studentName} has an outstanding fee balance of KES ${Number(r.balance).toLocaleString()}. Please log in to the parent portal to make payment or contact the school finance office.`,
      }),
      schoolId,
      sentByUserId: userId,
    });

    res.json({ ...result, message: `Fee reminder sent to ${result.total} parents` });
  } catch (err) { next(err); }
});

router.post("/whatsapp/fee-defaulters", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className, customMessage } = req.body;

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("name, whatsapp_business_number")
      .eq("school_id", schoolId)
      .single();
    if (schoolError) throw schoolError;
    if (!school?.whatsapp_business_number) {
      return res.status(400).json({ message: "Configure the school WhatsApp Business number first" });
    }

    const schoolName = school?.name || "EduCore";

    let studentQuery = supabase
      .from("students")
      .select("student_id, first_name, last_name, parent_phone, class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .not("parent_phone", "is", null);
    if (className && className !== "all") {
      studentQuery = studentQuery.eq("class_name", className);
    }
    const { data: students, error: studentError } = await studentQuery;
    if (studentError) throw studentError;

    if (!students?.length) {
      return res.status(404).json({ message: "No students with parent phone numbers found" });
    }

    const studentIds = students.map(s => s.student_id);
    const { data: invoices, error: invoiceError } = await supabase
      .from("invoices")
      .select("invoice_id, student_id, amount_due")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .in("student_id", studentIds);
    if (invoiceError) throw invoiceError;

    const invoiceIds = (invoices || []).map(i => i.invoice_id);
    let payments = [];
    if (invoiceIds.length) {
      const { data: paymentData } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .in("invoice_id", invoiceIds);
      payments = paymentData || [];
    }

    const invoiceMap = {};
    for (const inv of invoices || []) {
      invoiceMap[inv.invoice_id] = inv;
      if (!inv.studentBalance) inv.studentBalance = 0;
      inv.studentBalance += Number(inv.amount_due || 0);
    }
    for (const pay of payments) {
      const inv = invoiceMap[pay.invoice_id];
      if (inv) inv.studentBalance -= Number(pay.amount || 0);
    }

    const balanceByStudent = {};
    for (const inv of invoices || []) {
      balanceByStudent[inv.student_id] = (balanceByStudent[inv.student_id] || 0) + inv.studentBalance;
    }

    const defaulters = students.filter(s => balanceByStudent[s.student_id] > 0);
    if (!defaulters.length) {
      return res.json({ message: "No fee defaulters found", sent: 0 });
    }

    const links = [];
    let queued = 0;
    let failed = 0;

    for (const student of defaulters) {
      const balance = balanceByStudent[student.student_id];
      const studentName = `${student.first_name} ${student.last_name}`;
      const message = customMessage
        ? customMessage.replace("{studentName}", studentName).replace("{balance}", Number(balance).toLocaleString())
        : `*${schoolName}*\n\nOutstanding Fee Balance\n\nDear Parent/Guardian,\n\nYour child *${studentName}* has an outstanding fee balance of *KES ${Number(balance).toLocaleString()}*.\n\nPlease make payment at your earliest convenience.\n\n_${schoolName} Finance Office_`;

      const prepared = await sendViaWhatsApp([student.parent_phone], message, schoolId, userId);
      queued += prepared.queued;
      failed += prepared.failed;
      links.push(...(prepared.links || []).map(link => ({
        ...link,
        studentName,
        balance,
      })));
    }

    res.json({
      sent: 0,
      queued,
      failed,
      total: defaulters.length,
      links,
      message: `Prepared ${queued} defaulter WhatsApp chats`,
    });
  } catch (err) { next(err); }
});

export default router;
