import { Router } from "express";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// Helper: get Mpesa OAuth token
async function getMpesaToken() {
  const creds = Buffer.from(`${env.mpesaConsumerKey}:${env.mpesaConsumerSecret}`).toString("base64");
  const res = await fetch(`${env.mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  const data = await res.json();
  return data.access_token;
}

// Helper: log SMS
async function sendSmsLog(schoolId, recipient, message, userId) {
  try {
    await pool.query(
      `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
      VALUES (?, ?, ?, 'sms', 'sent', ?, NOW())`,
      [schoolId, recipient, message, userId || null]
    );
  } catch (_) { /* non-fatal */ }
}

// STK Push
router.post("/stk-push", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { phone, amount, studentId, studentName } = req.body;
    if (!phone || !amount || !studentId)
      return res.status(400).json({ message: "phone, amount and studentId are required" });

    const token     = await getMpesaToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const password  = Buffer.from(`${env.mpesaShortcode}${env.mpesaPasskey}${timestamp}`).toString("base64");

    const body = {
      BusinessShortCode: env.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: phone,
      PartyB: env.mpesaShortcode,
      PhoneNumber: phone,
      CallBackURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/callback`,
      AccountReference: `School fees - ${studentName || studentId}`,
      TransactionDesc:  `School fees - ${studentName || studentId}`,
    };

    const mpesaRes = await fetch(`${env.mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await mpesaRes.json();

    if (data.ResponseCode !== "0")
      return res.status(400).json({ message: data.ResponseDescription || "STK push failed" });

    await pool.query(
      `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status)
      VALUES (?, ?, ?, 'tuition', 'mpesa', ?, CURDATE(), 'pending')`,
      [schoolId, studentId, amount, data.CheckoutRequestID]
    );

    res.json({ ok: true, checkoutRequestId: data.CheckoutRequestID, message: "STK push sent to phone" });
  } catch (err) { next(err); }
});

// STK Callback
router.post("/callback", async (req, res, next) => {
  try {
    const body          = req.body?.Body?.stkCallback || req.body;
    const resultCode    = body?.ResultCode ?? body?.resultCode;
    const checkoutReqId = body?.CheckoutRequestID || body?.checkoutRequestId;

    if (String(resultCode) !== "0") {
      if (checkoutReqId) {
        await pool.query(
          `UPDATE payments SET status='failed', updated_at=CURRENT_TIMESTAMP WHERE reference_number=?`,
          [checkoutReqId]
        );
      }
      return res.json({ ok: true });
    }

    const items     = body?.CallbackMetadata?.Item || [];
    const get       = name => items.find(i => i.Name === name)?.Value;
    const amount    = get("Amount");
    const mpesaCode = get("MpesaReceiptNumber");
    const phone     = String(get("PhoneNumber") || "");

    // Update the pending payment row with the real Mpesa receipt number
    await pool.query(
      `UPDATE payments SET status='paid', reference_number=?, updated_at=CURRENT_TIMESTAMP
      WHERE reference_number=? AND status='pending'`,
      [mpesaCode, checkoutReqId]
    );

    // Fetch student info for SMS confirmation
    const [pending] = await pool.query(
      `SELECT p.school_id, p.student_id, s.phone AS parentPhone, s.first_name, s.last_name
      FROM payments p
      LEFT JOIN students s ON s.student_id = p.student_id
      WHERE p.reference_number = ? LIMIT 1`,
      [mpesaCode]
    );

    if (pending.length && pending[0].parentPhone) {
      const { school_id, first_name, last_name, parentPhone } = pending[0];
      const name = `${first_name || ""} ${last_name || ""}`.trim();
      const msg  = `Dear parent, payment of KES ${amount} received for ${name}. Mpesa Ref: ${mpesaCode}. Thank you.`;
      await sendSmsLog(school_id, parentPhone, msg);
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// C2B Register URLs
router.post("/register", authRequired, async (req, res, next) => {
  try {
    const token = await getMpesaToken();
    const body = {
      ShortCode:       env.mpesaShortcode,
      ResponseType:    "Completed",
      ConfirmationURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/c2b/confirm`,
      ValidationURL:   `${env.mpesaCallbackBaseUrl}/api/mpesa/c2b/validate`,
    };
    const mpesaRes = await fetch(`${env.mpesaBaseUrl}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await mpesaRes.json();
    res.json(data);
  } catch (err) { next(err); }
});

// C2B Validation
router.post("/c2b/validate", async (_req, res) => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// C2B Confirmation
router.post("/c2b/confirm", async (req, res, next) => {
  try {
    const b         = req.body || {};
    const transId   = b.TransID;
    const amount    = Number(b.TransAmount || 0);
    const msisdn    = String(b.MSISDN || "");
    const billRef   = b.BillRefNumber;
    const transTime = String(b.TransTime || "");

    let paymentDate = new Date().toISOString().slice(0, 10);
    if (/^\d{14}$/.test(transTime)) {
      paymentDate = `${transTime.slice(0,4)}-${transTime.slice(4,6)}-${transTime.slice(6,8)}`;
    }

    // Find student by admission number
    const [studentRows] = await pool.query(
      `SELECT student_id, school_id, first_name, last_name, phone, parent_phone
      FROM students WHERE admission_number = ? AND is_deleted = 0 LIMIT 1`,
      [billRef]
    );

    // If no student found, skip insert to avoid null FK and broken reports
    if (!studentRows.length) {
      console.warn(`[C2B Confirm] No student for billRef: ${billRef}. TransID: ${transId}`);
      return res.json({ ok: true, warning: "Student not found, payment not recorded" });
    }

    const student   = studentRows[0];
    const schoolId  = student.school_id;
    const studentId = student.student_id;
    const phone     = msisdn || student.parent_phone || student.phone || "";
    const name      = `${student.first_name} ${student.last_name}`;

    // Idempotent insert — ignore duplicate TransID
    await pool.query(
      `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status)
      VALUES (?, ?, ?, 'tuition', 'mpesa', ?, ?, 'paid')
      ON DUPLICATE KEY UPDATE status='paid', updated_at=CURRENT_TIMESTAMP`,
      [schoolId, studentId, amount, transId, paymentDate]
    );

    if (phone) {
      const msg = `Dear parent, payment of KES ${amount} received for ${name}. Mpesa Ref: ${transId}.`;
      await sendSmsLog(schoolId, phone, msg);
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Check payment status
router.get("/status/:checkoutRequestId", authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT status, reference_number, amount FROM payments WHERE reference_number = ? LIMIT 1`,
      [req.params.checkoutRequestId]
    );
    if (!rows.length) return res.status(404).json({ message: "Payment not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;