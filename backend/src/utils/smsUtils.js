// OLD: import { supabase } from '../config/supabaseClient.js';
// OLD: import { env } from '../config/env.js';
// OLD AFRICA'S TALKING CODE - MIGRATED TO WHATSAPP BUSINESS PER SCHOOL
// import africastalking from 'africastalking';
// All SMS functionality replaced with WhatsApp Business per-school mobile app
// Payment receipts now sent via wa.me links to school's WhatsApp number
// Zero cost solution using school's existing WhatsApp Business app

// OLD: import { sendWhatsAppPaymentReceipt } from '../services/whatsappService.js';
import { prepareWhatsAppMessage } from "./whatsappLinks.js";

// OLD AFRICAS TALKING CODE
// const at = africastalking({
//   apiKey: env.atApiKey,
//   username: env.atUsername,
// });

// Helper to send WhatsApp receipt for successful payments (replaces SMS)
export async function sendPaymentReceipt(schoolId, recipientPhone, amount, reference, studentName = "student") {
  try {
    // OLD AFRICAS TALKING CODE
    // // Get school-specific Sender ID
    // const { data: school } = await supabase
    //   .from('schools')
    //   .select('sms_sender_id')
    //   .eq('id', schoolId)
    //   .single();

    // const senderId = school?.sms_sender_id || 'EDUCORE';

    // const message = `Payment Receipt\n` +
    //   `Amount: KSh ${Number(amount).toLocaleString()}\n` +
    //   `Reference: ${reference}\n` +
    //   `For: ${studentName}\n` +
    //   `Date: ${new Date().toLocaleDateString()}\n` +
    //   `Thank you for your payment!`;

    // const response = await at.SMS.send({
    //   to: recipientPhone.startsWith('+') ? recipientPhone : `+254${recipientPhone.replace(/^0/, '')}`,
    //   message,
    //   from: senderId
    // });

    // await supabase.from('sms_logs').insert({
    //   school_id: schoolId,
    //   recipient: recipientPhone,
    //   message,
    //   channel: 'sms',
    //   status: response.SMSMessageData?.Recipients?.[0]?.status || 'Sent',
    //   cost_estimate: response.SMSMessageData?.Recipients?.[0]?.cost || 0,
    //   type: 'payment_receipt'
    // });

    // console.log('SMS receipt sent:', response);

    const message =
      `Payment Receipt\n` +
      `Student: ${studentName}\n` +
      `Amount: KES ${Number(amount).toLocaleString()}\n` +
      `Reference: ${reference}\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `Thank you for your payment.`;

    // OLD: const result = await sendWhatsAppPaymentReceipt({
    // OLD:   schoolId,
    // OLD:   recipientPhone,
    // OLD:   amount,
    // OLD:   reference,
    // OLD:   studentName
    // OLD: });
    const result = await prepareWhatsAppMessage({
      schoolId,
      recipientPhone,
      message,
      meta: {
        type: "payment_receipt",
        reference,
        amount: Number(amount),
        studentName,
      },
    });

    console.log('WhatsApp payment receipt prepared:', result);
    
  } catch (err) {
    console.error('WhatsApp payment receipt failed:', err);
    // OLD AFRICAS TALKING CODE
    // console.error('SMS receipt failed:', err);
  }
}
