import { Router } from "express";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// ─── Initialize Paystack transaction ─────────────────────────────────────────
router.post("/initialize", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { email, amount, studentId, studentName, admissionNumber, feeType = "tuition" } = req.body;

    if (!email || !amount || !studentId)
      return res.status(400).json({ message: "email, amount and studentId are required" });

    const amountKobo = Math.ceil(Number(amount) * 100); // Paystack uses kobo (100 kobo = 1 KES)

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: "KES",
        reference: `EDU-${schoolId}-${studentId}-${Date.now()}`,
        metadata: {
          schoolId,
          studentId,
          studentName,
          admissionNumber,
          feeType,
        },
        callback_url: `${env.paystackCallbackUrl}/api/paystack/callback`,
      }),
    });

    const data = await response.json();
    if (!data.status) return res.status(400).json({ message: data.message || "Paystack init failed" });

    // Store pending payment
    await pool.query(
      `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term)
       VALUES (?, ?, ?, ?, 'mpesa', ?, CURDATE(), 'pending', 'Term 2')
       ON DUPLICATE KEY UPDATE status='pending'`,
      [schoolId, studentId, amount, feeType, data.data.reference]
    );

    res.json({
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (err) { next(err); }
});

// ─── Verify transaction (called after redirect or polling) ───────────────────
router.get("/verify/:reference", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { reference } = req.params;

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
    });

    const data = await response.json();
    if (!data.status || data.data.status !== "success")
      return res.status(400).json({ message: "Payment not successful", status: data.data?.status });

    const tx       = data.data;
    const meta     = tx.metadata || {};
    const amount   = tx.amount / 100; // convert kobo back to KES
    const studentId = meta.studentId || null;

    // Update payment to paid
    const [result] = await pool.query(
      `UPDATE payments SET status='paid', updated_at=CURRENT_TIMESTAMP
       WHERE reference_number=? AND school_id=?`,
      [reference, schoolId]
    );

    // If no pending row existed, insert a new one
    if (!result.affectedRows) {
      await pool.query(
        `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status)
         VALUES (?, ?, ?, ?, 'mpesa', ?, CURDATE(), 'paid')`,
        [schoolId, studentId, amount, meta.feeType || "tuition", reference]
      );
    }

    // Send SMS confirmation via Africa's Talking
    if (studentId) {
      const [students] = await pool.query(
        `SELECT first_name, last_name, parent_phone FROM students WHERE student_id=? AND school_id=? LIMIT 1`,
        [studentId, schoolId]
      );
      if (students.length && students[0].parent_phone) {
        const s   = students[0];
        const msg = `Dear parent, payment of KES ${amount.toLocaleString()} received for ${s.first_name} ${s.last_name}. Ref: ${reference}. Thank you - EduCore`;
        await sendSms([students[0].parent_phone], msg, schoolId);
      }
    }

    res.json({ ok: true, amount, reference, studentId, channel: tx.channel });
  } catch (err) { next(err); }
});

// ─── Paystack webhook (server-to-server confirmation) ────────────────────────
router.post("/webhook", async (req, res, next) => {
  try {
    // Verify signature
    const crypto = await import("crypto");
    const hash   = crypto.createHmac("sha512", env.paystackSecretKey)
                         .update(JSON.stringify(req.body))
                         .digest("hex");
    if (hash !== req.headers["x-paystack-signature"])
      return res.status(401).json({ message: "Invalid signature" });

    const { event, data } = req.body;
    if (event !== "charge.success") return res.sendStatus(200);

    const reference = data.reference;
    const amount    = data.amount / 100;
    const meta      = data.metadata || {};
    const schoolId  = meta.schoolId || 1;
    const studentId = meta.studentId || null;

    await pool.query(
      `UPDATE payments SET status='paid', updated_at=CURRENT_TIMESTAMP WHERE reference_number=?`,
      [reference]
    );

    if (studentId) {
      const [students] = await pool.query(
        `SELECT first_name, last_name, parent_phone FROM students WHERE student_id=? LIMIT 1`,
        [studentId]
      );
      if (students.length && students[0].parent_phone) {
        const s   = students[0];
        const msg = `Dear parent, payment of KES ${amount.toLocaleString()} received for ${s.first_name} ${s.last_name}. Ref: ${reference}. Thank you - EduCore`;
        await sendSms([students[0].parent_phone], msg, schoolId);
      }
    }

    res.sendStatus(200);
  } catch (err) { next(err); }
});

// ─── Africa's Talking SMS helper ──────────────────────────────────────────────
async function sendSms(recipients, message, schoolId, sentByUserId = null) {
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
    const status = result?.SMSMessageData?.Recipients?.[0]?.status === "Success" ? "sent" : "failed";

    // Log each recipient
    for (const phone of recipients) {
      await pool.query(
        `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
         VALUES (?, ?, ?, 'sms', ?, ?, NOW())`,
        [schoolId, phone, message, status, sentByUserId]
      );
    }
    return result;
  } catch (err) {
    console.error("SMS error:", err);
  }
}

export { sendSms };
export default router;
