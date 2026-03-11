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
        metadata: { schoolId, studentId, studentName, admissionNumber, feeType },
        callback_url: `${env.paystackCallbackUrl}/api/paystack/callback`,
      }),
    });

    const data = await response.json();
    if (!data.status) return res.status(400).json({ message: data.message || "Paystack init failed" });

    // Bug #7 fixed: was inserting payment_method = 'mpesa' for a Paystack payment.
    // Changed to 'paystack'. Also removed hardcoded term column (not in schema).
    await pool.query(
      `INSERT INTO payments
        (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status)
      VALUES (?, ?, ?, ?, 'paystack', ?, CURDATE(), 'pending')
      ON DUPLICATE KEY UPDATE status='pending', updated_at=CURRENT_TIMESTAMP`,
      [schoolId, studentId, amount, feeType, data.data.reference]
    );

    res.json({
      authorizationUrl: data.data.authorization_url,
      accessCode:       data.data.access_code,
      reference:        data.data.reference,
    });
  } catch (err) { next(err); }
});

// ─── Paystack webhook (raw body — registered in app.js before express.json) ──
router.post("/webhook", async (req, res, next) => {
  try {
    const crypto = await import("crypto");
    const secret = env.paystackSecretKey || "";
    const hash   = crypto
      .createHmac("sha512", secret)
      .update(req.body)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = JSON.parse(req.body.toString());
    if (event.event !== "charge.success") return res.sendStatus(200);

    const { reference, amount, metadata } = event.data;
    const paidAmount = amount / 100; // convert from kobo
    const { schoolId, studentId, feeType } = metadata || {};

    await pool.query(
      `UPDATE payments
      SET status='paid', amount=?, updated_at=CURRENT_TIMESTAMP
      WHERE reference_number=? AND school_id=?`,
      [paidAmount, reference, schoolId]
    );

    res.sendStatus(200);
  } catch (err) { next(err); }
});

// ─── Paystack callback redirect (browser redirect after payment) ─────────────
router.get("/callback", async (req, res, next) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ message: "No reference provided" });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
    });
    const data = await response.json();

    if (data.data?.status === "success") {
      await pool.query(
        `UPDATE payments SET status='paid', updated_at=CURRENT_TIMESTAMP WHERE reference_number=?`,
        [reference]
      );
    }

    res.json({ status: data.data?.status, reference });
  } catch (err) { next(err); }
});

export default router;
