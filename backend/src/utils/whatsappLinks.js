import { supabase } from "../config/supabaseClient.js";

export function normalizeKenyanWhatsAppPhone(phone = "") {
  const digits = String(phone).replace(/[^\d]/g, "");

  if (!digits) return null;
  
  // Already in international format (2547... or 2541...)
  if (digits.startsWith("254") && digits.length === 12) return digits;
  
  // Kenyan format starting with 07... or 01... (10 digits)
  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  
  // Kenyan format starting with 7... or 1... (9 digits, missing 0)
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
    return `254${digits}`;
  }

  return null;
}

export function buildWaMeLink(phone, message) {
  const normalizedPhone = normalizeKenyanWhatsAppPhone(phone);
  if (!normalizedPhone) return null;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export async function prepareWhatsAppMessage({
  schoolId,
  recipientPhone,
  message,
  sentByUserId = null,
  meta = {},
}) {
  const normalizedPhone = normalizeKenyanWhatsAppPhone(recipientPhone);
  const waLink = normalizedPhone ? buildWaMeLink(normalizedPhone, message) : null;

  await supabase.from("sms_logs").insert({
    school_id: schoolId,
    recipient: recipientPhone,
    message,
    channel: "whatsapp",
    status: normalizedPhone ? "queued" : "failed",
    sent_by_user_id: sentByUserId,
    provider_response: JSON.stringify({
      provider: "wa.me",
      mode: "semi_automated_school_whatsapp",
      waLink,
      normalizedPhone,
      ...meta,
    }),
  });

  return {
    recipient: recipientPhone,
    normalizedPhone,
    waLink,
    status: normalizedPhone ? "queued" : "failed",
  };
}
