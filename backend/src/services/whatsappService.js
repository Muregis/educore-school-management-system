import { supabase } from '../config/supabaseClient.js';
import { env } from '../config/env.js';
import { createClient } from '@supabase/supabase-js';

// Create service role client for admin operations (bypasses RLS)
const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { autoRefreshToken: false }
});

/**
 * WhatsApp Business API Service
 * Replaces Africa's Talking SMS with WhatsApp messaging
 */

// Validate phone number for WhatsApp (international format)
function validateWhatsAppPhone(phone) {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Kenyan numbers: convert to +254 format
  if (cleanPhone.startsWith('254') && cleanPhone.length === 12) {
    return `+${cleanPhone}`;
  }
  
  // Kenyan numbers starting with 07: convert to +254
  if (cleanPhone.startsWith('07') && cleanPhone.length === 10) {
    return `+254${cleanPhone.slice(1)}`;
  }
  
  // Already in international format
  if (cleanPhone.length > 10 && !cleanPhone.startsWith('0')) {
    return `+${cleanPhone}`;
  }
  
  return null; // Invalid format
}

// Send WhatsApp message via Cloud API with enhanced fallback
async function sendWhatsAppMessage({ phone, message, schoolId, sentByUserId = null, messageType = 'text' }) {
  try {
    // Validate phone number
    const whatsappPhone = validateWhatsAppPhone(phone);
    if (!whatsappPhone) {
      throw new Error(`Invalid WhatsApp phone format: ${phone}`);
    }

    // Get school details for branding - multi-tenant isolation
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('name')  // Only select existing columns
      .eq('school_id', schoolId)  // Use school_id column
      // .eq('is_deleted', false)  // Temporarily removed for testing
      .single();

    if (schoolError || !school) {
      throw new Error(`School not found or access denied for school_id: ${schoolId}`);
    }

    const schoolName = school?.name || 'EduCore';
    // const businessId = school?.whatsapp_business_id || env.whatsappPhoneNumberId; // Column doesn't exist yet

    // Check if WhatsApp is configured
    if (!env.whatsappToken || !env.whatsappPhoneNumberId) {
      console.warn('WhatsApp not configured - message queued for fallback');
      
      // Fallback: Log as queued and try email if available
      await supabase.from('sms_logs').insert({
        school_id: schoolId,  // Tenant isolation
        recipient: phone,
        message,
        channel: 'sms',  // Use 'sms' channel until schema supports 'whatsapp'
        status: 'queued',
        sent_by_user_id: sentByUserId,
        provider_response: JSON.stringify({ error: 'WhatsApp not configured', fallback: 'queued' })
      });

      // Try email fallback for critical messages
      if (message.toLowerCase().includes('payment') || message.toLowerCase().includes('urgent')) {
        try {
          const { sendEmail } = await import('./email.service.js');
          await sendEmail({
            to: 'admin@' + schoolName.toLowerCase().replace(/\s+/g, '-') + '.edu',
            subject: `WhatsApp Fallback: ${schoolName}`,
            html: `<p>WhatsApp message could not be sent to ${phone}</p><p>Message: ${message}</p>`,
            schoolId  // Tenant isolation
          });
          console.log('Email fallback sent for critical message');
        } catch (emailErr) {
          console.error('Email fallback also failed:', emailErr);
        }
      }

      throw new Error('WhatsApp not configured - message queued');
    }

    // Prepare WhatsApp API payload
    const payload = {
      messaging_product: 'whatsapp',
      to: whatsappPhone.replace('+', ''), // Remove + for API
      type: messageType,
      [messageType]: {
        preview_url: false,
        body: message
      }
    };

    // Call WhatsApp Cloud API
    const response = await fetch(`${env.whatsappApiUrl}/${env.whatsappPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
    }

    // Log success with tenant isolation
    await supabase.from('sms_logs').insert({
      school_id: schoolId,  // Tenant isolation
      recipient: phone,
      message,
      channel: 'sms',  // Use 'sms' channel until schema supports 'whatsapp'
      status: result.messages?.[0]?.message_status || 'sent',
      sent_by_user_id: sentByUserId,
      provider_response: JSON.stringify(result),
      type: 'whatsapp_message'
    });

    console.log('WhatsApp message sent:', result);
    return {
      success: true,
      messageId: result.messages?.[0]?.id,
      status: result.messages?.[0]?.message_status || 'sent'
    };

  } catch (error) {
    console.error('WhatsApp message failed:', error);
    
    // Enhanced fallback logging with tenant isolation
    await supabase.from('sms_logs').insert({
      school_id: schoolId,  // Tenant isolation
      recipient: phone,
      message,
      channel: 'sms',  // Use 'sms' channel until schema supports 'whatsapp'
      status: 'failed',
      sent_by_user_id: sentByUserId,
      provider_response: JSON.stringify({ 
        error: error.message,
        fallback: 'logged_for_retry',
        timestamp: new Date().toISOString()
      })
    });

    // Don't throw error for non-critical failures to avoid breaking payment flows
    if (error.message.includes('not configured')) {
      return {
        success: false,
        error: error.message,
        fallback: 'queued'
      };
    }

    throw error;
  }
}

// Send WhatsApp payment receipt with enhanced formatting
async function sendWhatsAppPaymentReceipt({ schoolId, recipientPhone, amount, reference, studentName = "student" }) {
  try {
    // Get school details with tenant isolation
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('name')  // Only select existing columns
      .eq('school_id', schoolId)  // Use school_id column
      // .eq('is_deleted', false)  // Temporarily removed for testing
      .single();

    if (schoolError || !school) {
      throw new Error(`School not found or access denied for school_id: ${schoolId}`);
    }

    const schoolName = school?.name || 'EduCore';

    // Enhanced WhatsApp message format
    const message = `💰 *${schoolName}*\n\n` +
      `*Payment Received Successfully*\n\n` +
      `📝 *Details:*\n` +
      `• Amount: KES ${Number(amount).toLocaleString()}\n` +
      `• Reference: ${reference}\n` +
      `• Student: ${studentName}\n` +
      `• Date: ${new Date().toLocaleDateString()}\n\n` +
      `Thank you for your payment! 🎉\n\n` +
      `_Powered by EduCore School Management_`;

    return await sendWhatsAppMessage({
      phone: recipientPhone,
      message,
      schoolId,  // Tenant isolation
      messageType: 'text',
      type: 'payment_receipt'
    });

  } catch (error) {
    console.error('WhatsApp payment receipt failed:', error);
    throw error;
  }
}

// Send bulk WhatsApp messages
async function sendBulkWhatsAppMessages({ phones, message, schoolId, sentByUserId = null }) {
  const results = {
    sent: 0,
    failed: 0,
    total: phones.length,
    details: []
  };

  for (const phone of phones) {
    try {
      const result = await sendWhatsAppMessage({
        phone,
        message,
        schoolId,
        sentByUserId
      });
      
      results.sent++;
      results.details.push({ phone, status: 'sent', messageId: result.messageId });
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      results.failed++;
      results.details.push({ phone, status: 'failed', error: error.message });
    }
  }

  return results;
}

// Check WhatsApp configuration status
function getWhatsAppConfigStatus() {
  return {
    configured: Boolean(env.whatsappToken && env.whatsappApiUrl && env.whatsappPhoneNumberId),
    apiUrl: env.whatsappApiUrl || null,
    phoneNumberId: env.whatsappPhoneNumberId || null,
    hasToken: Boolean(env.whatsappToken)
  };
}

export {
  sendWhatsAppMessage,
  sendWhatsAppPaymentReceipt,
  sendBulkWhatsAppMessages,
  getWhatsAppConfigStatus,
  validateWhatsAppPhone
};
