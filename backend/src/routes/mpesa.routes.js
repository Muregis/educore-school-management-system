import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { env } from "../config/env.js";
// OLD AFRICAS TALKING CODE
// import africastalking from "africastalking"; // NEW: for SMS receipts
import { sendPaymentReceipt } from "../utils/smsUtils.js";
import paymentConfigService from "../services/payment-config.service.js";

const router = Router();

// OLD AFRICAS TALKING CODE
// // NEW: Africa's Talking instance (central account)
// const at = africastalking({
//   username: env.atUsername,
//   apiKey: env.atApiKey,
// });

// Helper: get Mpesa OAuth token (updated for multi-tenant)
async function getMpesaToken(schoolId) {
  // OLD: const creds = Buffer.from(`${env.mpesaConsumerKey}:${env.mpesaConsumerSecret}`).toString("base64");
  const mpesaConfig = await paymentConfigService.getMpesaConfig(schoolId);
  const creds = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString("base64");
  const res = await fetch(`${mpesaConfig.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  const data = await res.json();
  return data.access_token;
}

// Helper: log SMS (unchanged, already good)
async function sendSmsLog(schoolId, recipient, message, userId) {
  try {
    await supabase.from('sms_logs').insert({
      school_id: schoolId,
      recipient,
      message,
      channel: 'sms',
      status: 'sent',
      sent_by_user_id: userId || null
    });
  } catch (_) { /* non-fatal */ }
}

// STK Push (updated with SMS receipt prep)
router.post("/stk-push", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { phone, amount, studentId, studentName } = req.body;
    if (!phone || !amount || !studentId)
      return res.status(400).json({ message: "phone, amount and studentId are required" });

    const mpesaConfig = await paymentConfigService.getMpesaConfig(schoolId);
    const token     = await getMpesaToken(schoolId);
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    // OLD: const password  = Buffer.from(`${env.mpesaShortcode}${env.mpesaPasskey}${timestamp}`).toString("base64");
    const password  = Buffer.from(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`).toString("base64");

    const body = {
      // OLD: BusinessShortCode: env.mpesaShortcode,
      BusinessShortCode: mpesaConfig.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: phone,
      // OLD: PartyB: env.mpesaShortcode,
      PartyB: mpesaConfig.shortcode,
      PhoneNumber: phone,
      // OLD: CallBackURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/callback`,
      CallBackURL: `${mpesaConfig.callbackBaseUrl}/api/mpesa/callback`,
      AccountReference: `School fees - ${studentName || studentId}`,
      TransactionDesc:  `School fees - ${studentName || studentId}`,
    };

    // OLD: const mpesaRes = await fetch(`${env.mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
    const mpesaRes = await fetch(`${mpesaConfig.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await mpesaRes.json();

    if (data.ResponseCode !== "0")
      return res.status(400).json({ message: data.ResponseDescription || "STK push failed" });

    await supabase.from('payments').insert({
      school_id: schoolId,
      student_id: studentId,
      amount,
      fee_type: 'tuition',
      payment_method: 'mpesa',
      reference_number: data.CheckoutRequestID,
      payment_date: new Date().toISOString().slice(0, 10),
      status: 'pending'
    });

    res.json({ ok: true, checkoutRequestId: data.CheckoutRequestID, message: "STK push sent to phone" });
  } catch (err) { next(err); }
});

// STK Callback (updated with SMS receipt on success)
router.post("/callback", async (req, res, next) => {
  try {
    const body          = req.body?.Body?.stkCallback || req.body;
    const resultCode    = body?.ResultCode ?? body?.resultCode;
    const checkoutReqId = body?.CheckoutRequestID || body?.checkoutRequestId;

    if (String(resultCode) !== "0") {
      if (checkoutReqId) {
        // Get school_id from the payment before updating to prevent cross-tenant access
        const { data: paymentCheck, error: checkError } = await supabase
          .from('payments')
          .select('school_id')
          .eq('reference_number', checkoutReqId)
          .not('school_id', 'is', null)
          .maybeSingle();
        
        if (!checkError && paymentCheck) {
          await supabase
            .from('payments')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('reference_number', checkoutReqId)
            .eq('school_id', paymentCheck.school_id);
        }
      }
      return res.json({ ok: true });
    }

    const items     = body?.CallbackMetadata?.Item || [];
    const get       = name => items.find(i => i.Name === name)?.Value;
    const amount    = get("Amount");
    const mpesaCode = get("MpesaReceiptNumber");
    const phone     = String(get("PhoneNumber") || "");

    // Update the pending payment row with the real Mpesa receipt number
    const { data: paymentCheck, error: checkError } = await supabase
      .from('payments')
      .select('school_id, student_id, students(first_name, last_name)')
      .eq('reference_number', checkoutReqId)
      .not('school_id', 'is', null)
      .maybeSingle();
    
    if (!checkError && paymentCheck) {
      await supabase
        .from('payments')
        .update({ status: 'paid', reference_number: mpesaCode, updated_at: new Date().toISOString() })
        .eq('reference_number', checkoutReqId)
        .eq('status', 'pending')
        .eq('school_id', paymentCheck.school_id);

      // NEW: Send SMS receipt on success
      if (phone && paymentCheck.students) {
        const name = `${paymentCheck.students.first_name || ""} ${paymentCheck.students.last_name || ""}`.trim() || "student";
        await sendPaymentReceipt(paymentCheck.school_id, phone, amount, mpesaCode, name);
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// C2B Register URLs (updated for multi-tenant)
router.post("/register", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const mpesaConfig = await paymentConfigService.getMpesaConfig(schoolId);
    const token = await getMpesaToken(schoolId);
    const body = {
      // OLD: ShortCode: env.mpesaShortcode,
      ShortCode: mpesaConfig.shortcode,
      ResponseType: "Completed",
      // OLD: ConfirmationURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/c2b/confirm`,
      // OLD: ValidationURL: `${env.mpesaCallbackBaseUrl}/api/mpesa/c2b/validate`,
      ConfirmationURL: `${mpesaConfig.callbackBaseUrl}/api/mpesa/c2b/confirm`,
      ValidationURL: `${mpesaConfig.callbackBaseUrl}/api/mpesa/c2b/validate`,
    };
    // OLD: const mpesaRes = await fetch(`${env.mpesaBaseUrl}/mpesa/c2b/v1/registerurl`, {
    const mpesaRes = await fetch(`${mpesaConfig.baseUrl}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await mpesaRes.json();
    res.json(data);
  } catch (err) { next(err); }
});

// C2B Validation (unchanged)
router.post("/c2b/validate", async (_req, res) => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// C2B Confirmation (updated with SMS receipt)
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
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, school_id, first_name, last_name, phone, parent_phone')
      .eq('admission_number', billRef)
      .not('school_id', 'is', null)
      .eq('is_deleted', false)
      .maybeSingle();

    // If no student found, skip insert to avoid null FK and broken reports
    if (studentError || !student) {
      console.warn(`[C2B Confirm] No student for billRef: ${billRef}. TransID: ${transId}`);
      return res.json({ ok: true, warning: "Student not found, payment not recorded" });
    }

    const schoolId  = student.school_id;
    const studentId = student.student_id;
    const phone     = msisdn || student.parent_phone || student.phone || "";
    const name      = `${student.first_name} ${student.last_name}`.trim() || "student";

    // Idempotent insert — ignore duplicate TransID
    await supabase.from('payments').upsert({
      school_id: schoolId,
      student_id: studentId,
      amount,
      fee_type: 'tuition',
      payment_method: 'mpesa',
      reference_number: transId,
      payment_date: paymentDate,
      status: 'paid'
    }, { onConflict: 'reference_number' });

    // NEW: Send SMS receipt
    if (phone) {
      await sendPaymentReceipt(schoolId, phone, amount, transId, name);
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Check payment status (unchanged)
router.get("/status/:checkoutRequestId", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: payment, error } = await supabase
      .from('payments')
      .select('status, reference_number, amount')
      .eq('reference_number', req.params.checkoutRequestId)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (error || !payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (err) { next(err); }
});

export default router;
