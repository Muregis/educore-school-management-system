/**
 * Receipt handling utilities
 * Handles image compression and receipt metadata
 */

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_PDF_TYPES = ["application/pdf"];

export function validateReceiptFile(file) {
  if (!file) {
    return { valid: true, message: "Receipt is optional" };
  }

  const { size, type, name } = file;

  // Check file type
  const isPDF = ALLOWED_PDF_TYPES.includes(type);
  const isImage = ALLOWED_IMAGE_TYPES.includes(type);

  if (!isPDF && !isImage) {
    return {
      valid: false,
      message: `Invalid file type. Allowed: ${[...ALLOWED_IMAGE_TYPES.map((t) => t.split("/")[1]), "pdf"].join(", ")}`,
    };
  }

  // Check file size
  const maxSize = isPDF ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
  if (size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return { valid: false, message: `File too large. Maximum size: ${maxSizeMB}MB` };
  }

  return { valid: true, message: "Receipt file is valid" };
}

export function getReceiptMetadata(file) {
  if (!file) return null;

  const { size, type, name, lastModified } = file;
  const extension = name.split(".").pop().toLowerCase();

  return {
    originalName: name,
    extension,
    mimeType: type,
    sizeBytes: size,
    sizeMB: (size / (1024 * 1024)).toFixed(2),
    uploadedAt: new Date().toISOString(),
    isImage: ALLOWED_IMAGE_TYPES.includes(type),
    isPDF: ALLOWED_PDF_TYPES.includes(type),
  };
}

export function generateReceiptId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `receipt_${timestamp}_${random}`;
}

export async function compressImageFile(file, quality = 0.8) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  // Return a promise for browser-based compression
  // This would typically use a library like `browser-image-compression`
  // For now, we'll return metadata about compression
  return {
    original: file,
    compressed: file, // Would be compressed version
    compressionRatio: quality,
    message: "Use browser-image-compression library for client-side compression",
  };
}

export function buildCloudinaryUploadURL(cloudinaryConfig) {
  if (!cloudinaryConfig || !cloudinaryConfig.cloudName) {
    throw new Error("Cloudinary configuration is missing");
  }

  const { cloudName, uploadPreset } = cloudinaryConfig;
  return `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
}

export function buildSupabaseReceiptPath(schoolId, expenditureId) {
  return `schools/${schoolId}/receipts/${expenditureId}`;
}

export async function generateReceiptPreviewData(receiptUrl) {
  if (!receiptUrl) return null;

  const isPDF = receiptUrl.toLowerCase().endsWith(".pdf");
  const isImage =
    receiptUrl.match(/\.(jpg|jpeg|png|webp)$/i) || receiptUrl.includes("image") || receiptUrl.includes("cloudinary");

  return {
    url: receiptUrl,
    type: isPDF ? "pdf" : isImage ? "image" : "unknown",
    isPDF,
    isImage,
    previewableAsImage: isImage,
    previewableAsPDF: isPDF,
  };
}

export function validateReceiptURL(url) {
  if (!url) {
    return { valid: true, message: "Receipt URL is optional" };
  }

  try {
    const urlObj = new URL(url);
    // Check if URL is from trusted storage providers
    const trustedHosts = ["cloudinary.com", "supabase.co", "googleapis.com"];
    const isTrusted = trustedHosts.some((host) => urlObj.hostname.includes(host));

    if (!isTrusted) {
      console.warn(`Receipt URL from untrusted host: ${urlObj.hostname}`);
    }

    return { valid: true, message: "Receipt URL is valid", isTrusted };
  } catch (err) {
    return { valid: false, message: "Invalid receipt URL format" };
  }
}

export const receiptRequirementRules = {
  DEFAULT: { required: false, minAmount: 0 },
  LARGE_EXPENSE: { required: true, minAmount: 100000 }, // KES 100,000
  HIGH_VALUE_CATEGORY: {
    required: true,
    categories: ["Technology", "Transport", "Repairs", "Maintenance"],
  },
  TRAVEL: { required: true, minAmount: 50000 },
};

export function isReceiptRequired(expense, rules = receiptRequirementRules.DEFAULT) {
  if (!rules.required) {
    return false;
  }

  if (rules.minAmount && expense.amount >= rules.minAmount) {
    return true;
  }

  if (rules.categories && rules.categories.includes(expense.category)) {
    return true;
  }

  return false;
}
