import { Router } from "express";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { sendEmail, sendBulkEmail, isEmailConfigured, templates } from "../services/email.service.js";

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
        await pool.query(
          `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at, provider_response)
          VALUES (?, ?, ?, 'sms', ?, ?, NOW(), ?)`,
          [schoolId, r.number, message, status, sentByUserId, JSON.stringify(r)]
        );
        logs.push({ phone: r.number, status });
      }

      // Log any recipients AT didn't return
      const atNumbers = atRecipients.map(r => r.number);
      for (const phone of recipients) {
        if (!atNumbers.includes(phone)) {
          await pool.query(
            `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
             VALUES (?, ?, ?, 'sms', 'failed', ?, NOW())`,
            [schoolId, phone, message, sentByUserId]
          );
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
    await pool.query(
      `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
      VALUES (?, ?, ?, 'sms', 'queued', ?, NOW())`,
      [schoolId, phone, message, sentByUserId]
    );
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
    const [rows] = await pool.query(
      `SELECT sms_id, recipient, message, channel, status, sent_at, provider_response
      FROM sms_logs WHERE school_id=? AND is_deleted=0
      ORDER BY sent_at DESC LIMIT 300`,
      [schoolId]
    );
    res.json(rows);
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

    let sql      = `SELECT DISTINCT parent_phone AS phone FROM students
                    WHERE school_id=? AND is_deleted=0
                    AND parent_phone IS NOT NULL AND parent_phone != ''`;
    const params = [schoolId];
    if (className && className !== "all") {
      sql += " AND class_name=?";
      params.push(className);
    }

    const [rows] = await pool.query(sql, params);
    if (!rows.length)
      return res.status(404).json({ message: "No parent phone numbers found for this class" });

    const phones = rows.map(r => r.phone);
    const result = await sendViaSms(phones, message, schoolId, userId);

    res.json({ ...result, total: phones.length, recipients: phones });
  } catch (err) { next(err); }
});

// ─── PATCH sms log status ─────────────────────────────────────────────────────
router.patch("/sms-logs/:id/status", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.body;
    await pool.query(
      `UPDATE sms_logs SET status=? WHERE sms_id=? AND school_id=?`,
      [status, req.params.id, schoolId]
    );
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

    let sql = `SELECT s.student_id, s.first_name, s.last_name,
              u.email, s.parent_name
              FROM students s
              LEFT JOIN users u ON u.student_id = s.student_id AND u.role = 'parent' AND u.is_deleted = 0
              WHERE s.school_id=? AND s.is_deleted=0 AND u.email IS NOT NULL AND u.email != ''`;
    const params = [schoolId];
    if (className && className !== "all") { sql += " AND s.class_name=?"; params.push(className); }

    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ message: "No email addresses found for this class" });

    const recipients = rows.map(r => ({
      email: r.email,
      name:  r.parent_name || `${r.first_name} ${r.last_name}`,
    }));

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
    let sql = `SELECT s.first_name, s.last_name, s.parent_name, s.class_name,
              u.email,
              COALESCE(SUM(i.amount_due),0) - COALESCE(SUM(p.paid),0) AS balance
              FROM students s
              LEFT JOIN users u ON u.student_id = s.student_id AND u.role = 'parent' AND u.is_deleted = 0
              LEFT JOIN invoices i ON i.student_id = s.student_id AND i.school_id = s.school_id AND i.is_deleted = 0
              LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments WHERE school_id=? AND is_deleted=0 GROUP BY invoice_id) p
              ON p.invoice_id = i.invoice_id
              WHERE s.school_id=? AND s.is_deleted=0 AND u.email IS NOT NULL AND u.email != ''`;
    const params = [schoolId, schoolId];
    if (className && className !== "all") { sql += " AND s.class_name=?"; params.push(className); }
    sql += " GROUP BY s.student_id, u.email HAVING balance > 0";

    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.json({ message: "No fee defaulters with email found", sent: 0 });

    const subject = "Outstanding Fee Balance — Action Required";
    const result = await sendBulkEmail({
      recipients: rows.map(r => ({ email: r.email, name: r.parent_name || `${r.first_name} ${r.last_name}`, balance: r.balance, studentName: `${r.first_name} ${r.last_name}` })),
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