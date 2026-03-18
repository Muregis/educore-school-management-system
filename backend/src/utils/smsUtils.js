import { supabase } from '../config/supabaseClient.js';
import { env } from '../config/env.js';
import africastalking from 'africastalking';

const at = africastalking({
  apiKey: env.atApiKey,
  username: env.atUsername,
});

// Helper to send SMS receipt for successful payments
export async function sendPaymentReceipt(schoolId, recipientPhone, amount, reference, studentName = "student") {
  try {
    // Get school-specific Sender ID
    const { data: school } = await supabase
      .from('schools')
      .select('sms_sender_id')
      .eq('id', schoolId)
      .single();

    const senderId = school?.sms_sender_id || 'EDUCORE';

    const message = `Payment Receipt\n` +
      `Amount: KSh ${Number(amount).toLocaleString()}\n` +
      `Reference: ${reference}\n` +
      `For: ${studentName}\n` +
      `Date: ${new Date().toLocaleDateString()}\n` +
      `Thank you for your payment!`;

    const response = await at.SMS.send({
      to: recipientPhone.startsWith('+') ? recipientPhone : `+254${recipientPhone.replace(/^0/, '')}`,
      message,
      from: senderId
    });

    await supabase.from('sms_logs').insert({
      school_id: schoolId,
      recipient: recipientPhone,
      message,
      channel: 'sms',
      status: response.SMSMessageData?.Recipients?.[0]?.status || 'Sent',
      cost_estimate: response.SMSMessageData?.Recipients?.[0]?.cost || 0,
      type: 'payment_receipt'
    });

    console.log('SMS receipt sent:', response);
  } catch (err) {
    console.error('SMS receipt failed:', err);
  }
}
