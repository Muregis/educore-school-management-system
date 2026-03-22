import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { env } from "../config/env.js";
// OLD AFRICA'S TALKING CODE - MIGRATED TO WHATSAPP BUSINESS PER SCHOOL
// import africastalking from "africastalking"; // NEW: for SMS receipts
// All SMS functionality replaced with WhatsApp Business per-school mobile app
// Payment receipts now sent via wa.me links to school's WhatsApp number
// Zero cost solution using school's existing WhatsApp Business app
import { sendPaymentReceipt } from "../utils/smsUtils.js";
import paymentConfigService from "../services/payment-config.service.js";

const router = Router();

// OLD AFRICAS TALKING CODE
// // NEW: Africa's Talking instance (central account)
// const at = africastalking({
//   username: env.atUsername,
//   apiKey: env.atApiKey,
// });

// Helper: get Mpesa OAuth token (unchanged, not used here)
async function getMpesaToken() {
  const creds = Buffer.from(`${env.mpesaConsumerKey}:${env.mpesaConsumerSecret}`).toString("base64");
  const res = await fetch(`${env.mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  const data = await res.json();
  return data.access_token;
}

// NEW: SMS receipt helper
// ── Initialize transaction ────────────────────────────────────────────────────
router.post("/initialize", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { email, amount, studentId, studentName, admissionNumber, feeType = "tuition", parentPhone } = req.body; // NEW: parentPhone optional

    if (!email || !amount || !studentId)
      return res.status(400).json({ message: "email, amount and studentId are required" });

    const amountKobo = Math.ceil(Number(amount) * 100);
    const reference  = `EDU-${schoolId}-${studentId}-${Date.now()}`;

    // Get Paystack config for this school
    const paystackConfig = await paymentConfigService.getPaystackConfig(schoolId);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        // OLD: Authorization: `Bearer ${env.paystackSecretKey}`,
        Authorization: `Bearer ${paystackConfig.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email, amount: amountKobo, reference,
        metadata: { schoolId, studentId, studentName, admissionNumber, feeType, parentPhone }, // NEW: added parentPhone
        // OLD: callback_url: `${env.paystackCallbackUrl}`,
        callback_url: paystackConfig.callbackUrl || `${env.paystackCallbackUrl}`,
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
router.get("/verify/:reference", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { reference } = req.params;

    // Get Paystack config for this school
    const paystackConfig = await paymentConfigService.getPaystackConfig(schoolId);

    // OLD: const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    // OLD:   headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
    // OLD: });
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackConfig.secretKey}` },
    });
    const data = await response.json();

    if (!data.status || data.data?.status !== "success")
      return res.status(400).json({ message: "Payment not successful" });

    const paidAmount = data.data.amount / 100;
    const channel    = data.data.channel || "card";

    const { data: paymentCheck, error: checkError } = await supabase
      .from('payments')
      .select('school_id, student_id, students(first_name, last_name, parent_phone)')
      .eq('reference_number', reference)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (checkError || !paymentCheck) return res.status(404).json({ message: "Payment not found" });

    const { error: updErr } = await supabase
      .from('payments')
      .update({ status: 'paid', amount: paidAmount, updated_at: new Date().toISOString() })
      .eq('reference_number', reference)
      .eq('school_id', schoolId);
    if (updErr) throw updErr;

    // NEW: Send SMS receipt on success
    if (paymentCheck.students?.parent_phone) {
      const name = `${paymentCheck.students.first_name || ""} ${paymentCheck.students.last_name || ""}`.trim() || "student";
      await sendPaymentReceipt(schoolId, paymentCheck.students.parent_phone, paidAmount, reference, name);
    }

    res.json({ verified: true, amount: paidAmount, channel, reference });
  } catch (err) { next(err); }
});

// ── Webhook (Paystack calls this directly) ────────────────────────────────────
router.post("/webhook", async (req, res, next) => {
  try {
    const crypto = await import("crypto");
    
    // Extract school_id from metadata first to get correct config
    const event = JSON.parse(req.body.toString());
    if (event.event !== "charge.success") return res.sendStatus(200);

    const { reference, amount, metadata } = event.data;
    const { schoolId, studentId, parentPhone, studentName } = metadata || {};
    
    if (!schoolId) {
      console.error("SECURITY: Missing school_id in Paystack webhook metadata", { reference });
      return res.status(400).json({ message: "Invalid payment metadata" });
    }
    
    // Get Paystack config for this school
    const paystackConfig = await paymentConfigService.getPaystackConfig(schoolId);
    
    const secret = paystackConfig.secretKey || "";
    const hash   = crypto.createHmac("sha512", secret).update(req.body).digest("hex");
    if (hash !== req.headers["x-paystack-signature"])
      return res.status(400).json({ message: "Invalid signature" });

    const paidAmount = amount / 100;

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

    // NEW: Send SMS receipt on success
    if (parentPhone) {
      await sendPaymentReceipt(schoolId, parentPhone, paidAmount, reference, studentName || "student");
    }

    res.sendStatus(200);
  } catch (err) { next(err); }
});

// ── Browser callback after redirect payment ───────────────────────────────────
router.get("/callback", async (req, res, next) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ message: "No reference" });

    // First verify the transaction to get metadata using global key (initial)
    const tempResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
    });
    const tempData = await tempResponse.json();
    
    if (tempData.data?.status === "success") {
      // Extract school_id from payment metadata to prevent cross-school updates
      const { schoolId } = tempData.data.metadata || {};
      if (!schoolId) {
        console.error("Missing school_id in webhook metadata");
        return res.status(400).json({ message: "Invalid payment metadata" });
      }
      
      // Get Paystack config for this school
      const paystackConfig = await paymentConfigService.getPaystackConfig(schoolId);
      
      // Re-verify with school-specific config
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${paystackConfig.secretKey}` },
      });
      const data = await response.json();
      
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

      // NEW: Send SMS receipt on success (if phone in metadata)
      if (data.data.metadata?.parentPhone) {
        await sendPaymentReceipt(schoolId, data.data.metadata.parentPhone, data.data.amount / 100, reference, data.data.metadata.studentName || "student");
      }
    }
    res.json({ status: data.data?.status, reference });
  } catch (err) { next(err); }
});

export default router;
