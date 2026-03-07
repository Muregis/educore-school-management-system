import { Router } from "express";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// ─── Africa's Talking SMS sender ─────────────────────────────────────────────
async function sendViaSms(recipients, message, schoolId, sentByUserId = null) {
  const logs = [];

  // Try Africa's Talking if configured
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
          apiKey:         env.atApiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept:         "application/json",
        },
        body: params.toString(),
      });

      const result = await response.json();
      const atRecipients = result?.SMSMessageData?.Recipients || [];

      // Log per recipient with real status from AT
      for (const r of atRecipients) {
        const status = r.status === "Success" ? "sent" : "failed";
        await pool.query(
          `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at, provider_response)
           VALUES (?, ?, ?, 'sms', ?, ?, NOW(), ?)`,
          [schoolId, r.number, message, status, sentByUserId, JSON.stringify(r)]
        );
        logs.push({ phone: r.number, status });
      }

      // Handle any recipients not returned by AT
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
      return { sent: logs.filter(l => l.status === "sent").length, failed: logs.filter(l => l.status === "failed").length, logs };
    } catch (err) {
      console.error("AT SMS error:", err);
    }
  }

  // Fallback — log as queued if AT not configured
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
router.post("/sms", requireRoles("admin","teacher"), async (req, res, next) => {
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
router.post("/sms/bulk", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className, message } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    // Get all parent phones for the class
    let sql    = `SELECT DISTINCT parent_phone AS phone FROM students
                  WHERE school_id=? AND is_deleted=0 AND parent_phone IS NOT NULL AND parent_phone != ''`;
    const params = [schoolId];
    if (className && className !== "all") { sql += " AND class_name=?"; params.push(className); }

    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ message: "No recipients found for this class" });

    const phones = rows.map(r => r.phone);
    const result = await sendViaSms(phones, message, schoolId, userId);

    res.json({
      ...result,
      total:      phones.length,
      recipients: phones,
    });
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

export default router;