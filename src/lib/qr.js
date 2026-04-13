const DEFAULT_PUBLIC_APP_URL = "https://educore-school-management-system-pi.vercel.app";

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function getPublicAppBaseUrl() {
  const configuredUrl =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_APP_URL
      ? import.meta.env.VITE_PUBLIC_APP_URL
      : DEFAULT_PUBLIC_APP_URL;

  return trimTrailingSlash(configuredUrl || DEFAULT_PUBLIC_APP_URL);
}

export function getStudentQrIdentifier(student) {
  return String(
    student?.student_id ??
    student?.id ??
    student?.admission_number ??
    student?.admission ??
    ""
  ).trim();
}

export function buildStudentVerificationUrl(student) {
  const identifier = getStudentQrIdentifier(student);
  if (!identifier) throw new Error("Student identifier is required for QR generation");
  return `${getPublicAppBaseUrl()}/verify/${encodeURIComponent(identifier)}`;
}

export function parseStudentQrContent(qrText) {
  const rawValue = String(qrText || "").trim();
  if (!rawValue) return null;

  try {
    const url = new URL(rawValue);
    const match = url.pathname.match(/^\/verify\/([^/]+)$/i);
    if (match) {
      return { type: "verify-url", studentId: decodeURIComponent(match[1]) };
    }
  } catch {
    // Not a URL, continue to legacy JSON handling.
  }

  try {
    const parsed = JSON.parse(rawValue);
    const studentId = parsed?.student_id ?? parsed?.studentId ?? parsed?.id ?? parsed?.admission ?? parsed?.admission_number;
    if (studentId != null && String(studentId).trim() !== "") {
      return { type: "legacy-json", studentId: String(studentId).trim(), data: parsed };
    }
  } catch {
    // Ignore malformed legacy JSON.
  }

  return null;
}
