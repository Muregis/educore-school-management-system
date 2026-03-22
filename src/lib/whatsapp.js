export function normalizeKenyanWhatsAppPhone(phone = "") {
  const digits = String(phone).replace(/[^\d]/g, "");

  if (!digits) return null;
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;

  return null;
}

export function buildWaMeLink(phone, message) {
  const normalizedPhone = normalizeKenyanWhatsAppPhone(phone);
  if (!normalizedPhone) return null;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
