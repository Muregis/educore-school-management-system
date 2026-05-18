/**
 * M-Pesa transaction code validation and formatting utilities
 * Supports M-Pesa transaction codes, phone validation, and transaction parsing
 */

// M-Pesa transaction code patterns
const MPESA_CODE_PATTERN = /^[A-Z0-9]{10}$/; // 10-character alphanumeric
const MPESA_PHONE_PATTERN = /^(\+254|0)([0-9]{9})$/; // +254 or 0 followed by 9 digits
const TRANSACTION_ID_PATTERN = /^[A-Z0-9]{1,15}$/; // Generic transaction ID

export function validateMpesaCode(code) {
  if (!code) {
    return { valid: true, message: "M-Pesa code is optional" };
  }

  const cleanCode = code.trim().toUpperCase();

  if (!MPESA_CODE_PATTERN.test(cleanCode)) {
    return {
      valid: false,
      message: "Invalid M-Pesa code format. Expected 10 alphanumeric characters (e.g., UE2JE2N2SK)",
    };
  }

  return { valid: true, message: "M-Pesa code is valid", code: cleanCode };
}

export function formatMpesaCode(code) {
  if (!code) return "";
  return code.trim().toUpperCase();
}

export function validatePhoneNumber(phone) {
  if (!phone) {
    return { valid: false, message: "Phone number is required" };
  }

  const cleaned = phone.replace(/\s/g, "");

  if (!MPESA_PHONE_PATTERN.test(cleaned)) {
    return {
      valid: false,
      message: "Invalid phone number format. Use +254XXXXXXXXX or 0XXXXXXXXX",
    };
  }

  return { valid: true, message: "Phone number is valid", phone: cleaned };
}

export function normalizePhoneNumber(phone) {
  if (!phone) return "";

  let cleaned = phone.replace(/\s/g, "");

  // Convert 0... to +254...
  if (cleaned.startsWith("0")) {
    cleaned = "+254" + cleaned.substring(1);
  }

  // Ensure +254 prefix
  if (!cleaned.startsWith("+254")) {
    cleaned = "+254" + cleaned;
  }

  return cleaned;
}

export function extractPhoneCountry(phone) {
  const normalized = normalizePhoneNumber(phone);

  if (normalized.startsWith("+254")) {
    return { country: "KE", countryName: "Kenya", code: "+254" };
  }

  return { country: "UNKNOWN", countryName: "Unknown", code: "" };
}

export function validateTransactionReference(reference) {
  if (!reference) {
    return { valid: true, message: "Transaction reference is optional" };
  }

  const cleaned = reference.trim().toUpperCase();

  if (!TRANSACTION_ID_PATTERN.test(cleaned)) {
    return {
      valid: false,
      message: "Invalid transaction reference format. Use alphanumeric characters only (1-15 characters)",
    };
  }

  return { valid: true, message: "Transaction reference is valid", reference: cleaned };
}

export function formatTransactionReference(reference) {
  if (!reference) return "";
  return reference.trim().toUpperCase();
}

export function generateMockMpesaCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function parseMpesaMessage(message) {
  // Parse typical M-Pesa SMS format: "You have received KES 1,000 from John Doe (0722000000) on 01/01/2024 at 14:30PM."
  // This is a simplified parser

  if (!message || typeof message !== "string") {
    return null;
  }

  const patterns = {
    amount: /KES\s+([\d,]+)/i,
    from: /from\s+([A-Za-z\s]+?)\s*\(/,
    phone: /\(([\d+\-\s]+?)\)/,
    date: /on\s+(\d{2}\/\d{2}\/\d{4})/,
    time: /at\s+(\d{2}:\d{2}[AP]M)/,
  };

  const result = {};

  Object.entries(patterns).forEach(([key, pattern]) => {
    const match = message.match(pattern);
    if (match) {
      result[key] = match[1];
    }
  });

  if (result.amount) {
    result.amountNumeric = Number(result.amount.replace(/,/g, ""));
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function paymentMethodToMpesaMethod(paymentMethod) {
  const mappings = {
    mpesa: "M-Pesa",
    "m-pesa": "M-Pesa",
    bank: "Bank Transfer",
    cash: "Cash",
    cheque: "Cheque",
    online: "Online Payment",
  };

  return mappings[paymentMethod?.toLowerCase()] || paymentMethod;
}

export const mpesaPaymentMethods = ["M-Pesa", "Bank Transfer", "Cash", "Cheque", "Online Payment"];

export function validatePaymentMethod(method) {
  const normalized = paymentMethodToMpesaMethod(method);
  const isValid = mpesaPaymentMethods.includes(normalized);

  return {
    valid: isValid,
    method: normalized,
    message: isValid ? "Payment method is valid" : `Invalid payment method. Allowed: ${mpesaPaymentMethods.join(", ")}`,
  };
}

// M-Pesa STK Push simulation (for future implementation)
export async function initiateMpesaStkPush(config = {}) {
  // This is a placeholder for future M-Pesa STK Push integration
  // Would require: PartyA (phone), Amount, CallBackURL
  throw new Error("M-Pesa STK Push not yet implemented. Use transaction codes for verification.");
}

// M-Pesa transaction status check (for future implementation)
export async function checkMpesaTransactionStatus(config = {}) {
  // This is a placeholder for future M-Pesa transaction status API
  // Would require: Credentials, TransactionID, Timestamp
  throw new Error("M-Pesa status check not yet implemented. Verify using transaction code manually.");
}

export const mpesaDocumentation = {
  transactionCodeFormat: "10 alphanumeric characters (e.g., UE2JE2N2SK, QWE45RTY12)",
  phoneFormat: "Kenyan format: +254XXXXXXXXX or 0XXXXXXXXX",
  supportedMethods: mpesaPaymentMethods,
  requiresInternet: true,
  offlineSupport: "Can record transaction code for later verification",
};
