import { Router } from "express";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getMpesaToken() {
  const auth = Buffer.from(`${env.mpesaConsumerKey}:${env.mpesaConsumerSecret}`).toString("base64");
  const res = await fetch(
    `${env.mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get Mpesa token");
  return data.access_token;
}

function mpesaTimestamp() {
  return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function mpesaPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

async function sendSmsLog(schoolId, phone, message, userId = null) {
  await pool.query(
    `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
    VALUES (?, ?, ?, 'sms', 'sent', ?, NOW())`,
    [schoolId, phone, message, userId]
  );
}

// ─── STK Push ────────────────────────────────────────────────────────────────

router.post("/stk-push", authRequired, async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { phone, amount, studentId, admissionNumber, studentName } = req.body;

    if (!phone || !amount || !studentId) {
      return res.status(400).json({ message: "phone, amount and studentId are required" });
    }

    // Normalise phone: 0712345678 → 254712345678
    const normalised = String(phone).replace(/^0/, "254").replace(/^\+/, "");

    const token = await getMpesaToken();
    const timestamp = mpesaTimestamp();
    const password = mpesaPassword(env.mpesaShortcode, env.mpesaPasskey, timestamp);

    const body = {
      BusinessShortCode: env.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: normalised,
      PartyB: env.mpesaShortcode,
      PhoneNumber: normalised,
      CallBackURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/callback`,
      AccountReference: admissionNumber || `STU${studentId}`,
      TransactionDesc: `School fees - ${studentName || studentId}`,
    };

    const mpesaRes = await fetch(`${env.mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const data = await mpesaRes.json();

    if (data.ResponseCode !== "0") {
      return res.status(400).json({ message: data.ResponseDescription || "STK push failed" });
    }

    // Store pending payment
    await pool.query(
      `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term)
       VALUES (?, ?, ?, 'tuition', 'mpesa', ?, CURDATE(), 'pending', 'Term 2')`,
      [schoolId, studentId, amount, data.CheckoutRequestID]
    );

    res.json({ ok: true, checkoutRequestId: data.CheckoutRequestID, message: "STK push sent to phone" });
  } catch (err) {
    next(err);
  }
});

// ─── STK Callback (from Safaricom) ──────────────────────────────────────────

router.post("/callback", async (req, res, next) => {
  try {
    const body = req.body?.Body?.stkCallback || req.body;
    const resultCode = body?.ResultCode ?? body?.resultCode;
    const checkoutRequestId = body?.CheckoutRequestID || body?.checkoutRequestId;

    if (String(resultCode) !== "0") {
      // Payment failed or cancelled — mark pending as failed
      if (checkoutRequestId) {
        await pool.query(
          `UPDATE payments SET status='failed', updated_at=CURRENT_TIMESTAMP WHERE reference_number=?`,
          [checkoutRequestId]
        );
      }
      return res.json({ ok: true });
    }

    const items = body?.CallbackMetadata?.Item || [];
    const get = name => items.find(i => i.Name === name)?.Value;

    const amount       = get("Amount");
    const mpesaCode    = get("MpesaReceiptNumber");
    const phone        = get("PhoneNumber");
    const billRef      = get("BillRefNumber") || get("AccountReference");

    // Find school from pending payment
    const [pending] = await pool.query(
      `SELECT p.school_id, p.student_id, s.phone AS parentPhone, s.first_name, s.last_name
       FROM payments p
       LEFT JOIN students s ON s.student_id = p.student_id
       WHERE p.reference_number = ? LIMIT 1`,
      [checkoutRequestId]
    );

    const schoolId  = pending[0]?.school_id  || 1;
    const studentId = pending[0]?.student_id || null;
    const parentPhone = String(phone || pending[0]?.parentPhone || "");
    const studentName = pending[0] ? `${pending[0].first_name} ${pending[0].last_name}` : "Student";

    // Update pending payment or insert new
    if (pending.length) {
      await pool.query(
        `UPDATE payments SET status='paid', reference_number=?, payment_date=CURDATE(), updated_at=CURRENT_TIMESTAMP
         WHERE reference_number=?`,
        [mpesaCode, checkoutRequestId]
      );
    } else {
      await pool.query(
        `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term)
         VALUES (?, ?, ?, 'tuition', 'mpesa', ?, CURDATE(), 'paid', 'Term 2')`,
        [schoolId, studentId, amount, mpesaCode]
      );
    }

    // Send SMS confirmation
    const msg = `Dear parent, payment of KES ${amount} received for ${studentName}. Ref: ${mpesaCode}. Thank you.`;
    await sendSmsLog(schoolId, parentPhone, msg);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── C2B Register URLs ────────────────────────────────────────────────────────

router.post("/register", authRequired, async (req, res, next) => {
  try {
    const token = await getMpesaToken();
    const body = {
      ShortCode: env.mpesaShortcode,
      ResponseType: "Completed",
      ConfirmationURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/c2b/confirm`,
      ValidationURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/c2b/validate`,
    };

    const mpesaRes = await fetch(`${env.mpesaBaseUrl}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await mpesaRes.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── C2B Validation (Safaricom calls this before processing) ─────────────────

router.post("/c2b/validate", async (req, res) => {
  // Accept all payments
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ─── C2B Confirmation (Safaricom confirms payment) ────────────────────────────

router.post("/c2b/confirm", async (req, res, next) => {
  try {
    const b = req.body || {};
    const transId     = b.TransID;
    const amount      = Number(b.TransAmount || 0);
    const msisdn      = String(b.MSISDN || "");
    const billRef     = b.BillRefNumber; // admission number
    const transTime   = String(b.TransTime || "");

    let paymentDate = new Date().toISOString().slice(0, 10);
    if (/^\d{14}$/.test(transTime)) {
      paymentDate = `${transTime.slice(0,4)}-${transTime.slice(4,6)}-${transTime.slice(6,8)}`;
    }

    // Find student by admission number
    const [studentRows] = await pool.query(
      `SELECT student_id, school_id, first_name, last_name, phone FROM students
       WHERE admission_number = ? AND is_deleted = 0 LIMIT 1`,
      [billRef]
    );

    const student   = studentRows[0];
    const schoolId  = student?.school_id || 1;
    const studentId = student?.student_id || null;
    const phone     = msisdn || student?.phone || "";
    const name      = student ? `${student.first_name} ${student.last_name}` : billRef;

    await pool.query(
      `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term)
       VALUES (?, ?, ?, 'tuition', 'mpesa', ?, ?, 'paid', 'Term 2')`,
      [schoolId, studentId, amount, transId, paymentDate]
    );

    // SMS confirmation
    const msg = `Dear parent, payment of KES ${amount} received for ${name}. Mpesa Ref: ${transId}. Thank you.`;
    await sendSmsLog(schoolId, phone, msg);

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    next(err);
  }
});

// ─── Check payment status ─────────────────────────────────────────────────────

router.get("/status/:checkoutRequestId", authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT status, reference_number, amount FROM payments WHERE reference_number = ? LIMIT 1`,
      [req.params.checkoutRequestId]
    );
    if (!rows.length) return res.status(404).json({ message: "Payment not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
