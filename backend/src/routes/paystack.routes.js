import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";
import { agentLog } from "../utils/agentDebugLog.js";

const router = Router();
router.use(authRequired);

// ── Initialize transaction ────────────────────────────────────────────────────
router.post("/initialize", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { email, amount, studentId, studentName, admissionNumber, feeType = "tuition" } = req.body;

    if (!email || !amount || !studentId)
      return res.status(400).json({ message: "email, amount and studentId are required" });

    const amountKobo = Math.ceil(Number(amount) * 100);
    const reference  = `EDU-${schoolId}-${studentId}-${Date.now()}`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email, amount: amountKobo, reference,
        metadata: { schoolId, studentId, studentName, admissionNumber, feeType },
        callback_url: `${env.paystackCallbackUrl}`,
      }),
    });

    const data = await response.json();
    if (!data.status) return res.status(400).json({ message: data.message || "Paystack init failed" });

    // Ensure student exists in Supabase before creating payment record
    const { data: stu, error: stuErr } = await supabase
      .from("students")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("is_deleted", false)
      .limit(1)
      .maybeSingle();
    if (stuErr) throw stuErr;
    if (!stu) return res.status(404).json({ message: "Student not found" });

    const today = new Date().toISOString().slice(0, 10);
    const paymentRow = {
      school_id: schoolId,
      student_id: studentId,
      amount: Number(amount),
      fee_type: feeType,
      payment_method: "paystack",
      reference_number: data.data.reference,
      payment_date: today,
      status: "pending",
    };

    const { error: insErr } = await supabase.from("payments").insert(paymentRow);
    if (insErr) {
      // Postgres unique violation
      if (insErr.code === "23505") {
        const { error: updErr } = await supabase
          .from("payments")
          .update({ status: "pending", amount: paymentRow.amount, payment_date: today })
          .eq("school_id", schoolId)
          .eq("reference_number", paymentRow.reference_number);
        if (updErr) throw updErr;
      } else {
        throw insErr;
      }
    }

    res.json({
      authorizationUrl: data.data.authorization_url,
      accessCode:       data.data.access_code,
      reference:        data.data.reference,
    });
  } catch (err) { next(err); }
});

// ── Verify transaction (called by frontend after popup closes) ────────────────
router.get("/verify/:reference", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { reference } = req.params;

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
    });
    const data = await response.json();

    if (!data.status || data.data?.status !== "success")
      return res.status(400).json({ message: "Payment not successful" });

    const paidAmount = data.data.amount / 100;
    const channel    = data.data.channel || "card";

    // #region agent log
    agentLog({sessionId:"cdda91",runId:"verify",hypothesisId:"H6",location:"backend/src/routes/paystack.routes.js:110",message:"paystack verify success; updating payment",data:{schoolId,reference,paidAmount,channel},timestamp:Date.now()});
    // #endregion

    const { data: paymentData, error } = await supabase
      .from("payments")
      .update({ status: "paid", amount: paidAmount })
      .eq("school_id", schoolId)
      .eq("reference_number", reference);
    if (error) throw error;

    res.json({ verified: true, amount: paidAmount, channel, reference });
  } catch (err) { next(err); }
});

// ── Webhook (Paystack calls this directly) ────────────────────────────────────
router.post("/webhook", async (req, res, next) => {
  try {
    const crypto = await import("crypto");
    const secret = env.paystackSecretKey || "";
    const hash   = crypto.createHmac("sha512", secret).update(req.body).digest("hex");
    if (hash !== req.headers["x-paystack-signature"])
      return res.status(400).json({ message: "Invalid signature" });

    const event = JSON.parse(req.body.toString());
    if (event.event !== "charge.success") return res.sendStatus(200);

    const { reference, amount, metadata } = event.data;
    const paidAmount = amount / 100;
    const { schoolId } = metadata || {};

    // NEW: Validate webhook tenant safety
    if (!schoolId) {
      console.error("SECURITY: Missing school_id in Paystack webhook metadata", { reference });
      return res.status(400).json({ message: "Invalid payment metadata" });
    }

    // Verify payment belongs to the correct school before updating
    const { data: paymentCheck, error: checkError } = await supabase
      .from('payments')
      .select('school_id')
      .eq('reference_number', reference)
      .eq('school_id', schoolId)
      .maybeSingle();
    
    if (checkError || !paymentCheck) {
      console.error("SECURITY: Cross-tenant webhook attempt", { reference, webhookSchoolId: schoolId });
      return res.status(403).json({ message: "Payment not found for this school" });
    }

    const { error: updErr } = await supabase
      .from('payments')
      .update({ status: 'paid', amount: paidAmount, updated_at: new Date().toISOString() })
      .eq('reference_number', reference)
      .eq('school_id', schoolId);
    if (updErr) throw updErr;
    res.sendStatus(200);
  } catch (err) { next(err); }
});

// ── Browser callback after redirect payment ───────────────────────────────────
router.get("/callback", async (req, res, next) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ message: "No reference" });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
    });
    const data = await response.json();

    if (data.data?.status === "success") {
      // Extract school_id from payment metadata to prevent cross-school updates
      const { schoolId } = data.data.metadata || {};
      if (!schoolId) {
        console.error("Missing school_id in webhook metadata");
        return res.status(400).json({ message: "Invalid payment metadata" });
      }
      
      const { data: paymentCheck, error: checkError } = await supabase
        .from('payments')
        .select('school_id')
        .eq('reference_number', reference)
        .eq('school_id', schoolId)
        .maybeSingle();
      
      if (checkError || !paymentCheck) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      const { error: updErr } = await supabase
        .from('payments')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('reference_number', reference)
        .eq('school_id', schoolId);
      if (updErr) throw updErr;
    }
    res.json({ status: data.data?.status, reference });
  } catch (err) { next(err); }
});

export default router;